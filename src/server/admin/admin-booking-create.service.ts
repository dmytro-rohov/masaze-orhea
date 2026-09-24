import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookingAddons, bookings, massages, massageVariants, specialists } from "@/db/schema";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import {
  busyPeriodsOverlap,
  getSpecialistGoogleBusyPeriods,
} from "@/server/bookings/booking.availability";
import { resolveBookingAddons } from "@/server/bookings/booking-addons.service";
import { bookingBlocksAvailability } from "@/server/bookings/booking-blocking.condition";
import { syncBookingToGoogleCalendar } from "@/server/bookings/booking-calendar-sync.service";
import { attemptBookingCustomerNotification } from "@/server/bookings/booking-customer-notification.service";
import { getBookingBufferMinutes } from "@/server/bookings/booking-settings.service";
import {
  createBookingDateTime,
  doesBusyIntervalFitWorkingWindow,
  getBookingDayRange,
  MILLISECONDS_PER_MINUTE,
} from "@/server/bookings/booking-time-zone";
import {
  getBookingTimeHorizonError,
  getSpecialistAvailabilityForDate,
} from "@/server/bookings/booking-time-window.service";

import type { AdminBookingCreateInput } from "./admin-booking-create.validation";

export type AdminBookingConflictType =
  | "booking_overlap"
  | "booking_buffer"
  | "google_busy"
  | "outside_working_hours"
  | "date_override_unavailable"
  | "min_notice"
  | "max_advance"
  | "max_bookings_per_day";

export type AdminBookingConflict = {
  type: AdminBookingConflictType;
  message: string;
  bookingId?: string;
  startAt?: string;
  endAt?: string;
};

type AdminBookingCreateFailureReason =
  | "forbidden"
  | "variant_not_found"
  | "variant_unavailable"
  | "specialist_unavailable"
  | "addon_unavailable"
  | "invalid_start_time"
  | "configuration_failure"
  | "data_changed";

export type AdminBookingCreateResult =
  | {
      success: true;
      bookingId: string;
      alreadyApplied: boolean;
      calendarSyncStatus: "pending" | "synced" | "failed";
      notificationSent?: boolean;
    }
  | {
      success: false;
      reason: "requires_override";
      conflicts: AdminBookingConflict[];
    }
  | {
      success: false;
      reason: AdminBookingCreateFailureReason;
      errorCode?: string;
    };

type QueryExecutor = Pick<typeof db, "select">;

const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
});
const timeFormatter = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

const configurationErrorCodes = new Set([
  "BOOKING_SETTINGS_NOT_FOUND",
  "SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND",
  "SPECIALIST_AVAILABILITY_CONFIGURATION_INVALID",
  "SPECIALIST_AVAILABILITY_OVERRIDE_INVALID",
  "SPECIALIST_AVAILABILITY_CALENDAR_NOT_FOUND",
  "GOOGLE_CALENDAR_NOT_FOUND",
  "GOOGLE_CALENDAR_QUERY_FAILED",
  "GOOGLE_CALENDAR_UNAVAILABLE",
]);

const addonSelectionErrorCodes = new Set([
  "BOOKING_ADDONS_INVALID_INPUT",
  "BOOKING_ADDONS_DUPLICATE",
  "BOOKING_ADDONS_UNAVAILABLE",
  "BOOKING_ADDON_MASSAGE_NOT_FOUND",
]);

const parseWarsawStartAt = (date: string, time: string): Date | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !match) return null;

  try {
    return createBookingDateTime(
      date,
      Number(match[1]) * 3600 + Number(match[2]) * 60,
    );
  } catch {
    return null;
  }
};

const getSelectedVariant = async (
  executor: QueryExecutor,
  massageId: string,
  variantCode: string,
) => {
  const [variant] = await executor
    .select({
      massageId: massages.id,
      massageName: massages.name,
      massageIsActive: massages.isActive,
      bookingAvailable: massages.bookingAvailable,
      variantId: massageVariants.id,
      variantCode: massageVariants.code,
      variantIsActive: massageVariants.isActive,
      durationMinutes: massageVariants.durationMinutes,
      durationLabel: massageVariants.durationLabel,
      bookingSlotMinutes: massageVariants.bookingSlotMinutes,
      priceGrosze: massageVariants.priceGrosze,
    })
    .from(massageVariants)
    .innerJoin(massages, eq(massageVariants.massageId, massages.id))
    .where(
      and(
        eq(massages.id, massageId),
        eq(massageVariants.code, variantCode),
      ),
    )
    .limit(1);

  return variant ?? null;
};

const getActiveSpecialist = async (
  executor: QueryExecutor,
  specialistId: AdminBookingCreateInput["specialistId"],
) => {
  const [specialist] = await executor
    .select({
      id: specialists.id,
      displayName: specialists.displayName,
      isActive: specialists.isActive,
    })
    .from(specialists)
    .where(eq(specialists.id, specialistId))
    .limit(1);

  return specialist?.isActive ? specialist : null;
};

const collectDatabaseConflicts = async (
  executor: QueryExecutor,
  input: {
    specialistId: AdminBookingCreateInput["specialistId"];
    date: string;
    startAt: Date;
    endAt: Date;
    bufferMinutes: number;
    maxBookingsPerDay: number | null;
  },
): Promise<AdminBookingConflict[]> => {
  const candidateEffectiveEnd = new Date(
    input.endAt.getTime() + input.bufferMinutes * MILLISECONDS_PER_MINUTE,
  );
  const dayRange = getBookingDayRange(input.date);
  const effectiveStart = sql<Date>`
    CASE WHEN ${bookings.status} = 'confirmed'
      THEN COALESCE(${bookings.confirmedStartAt}, ${bookings.requestedStartAt})
      ELSE ${bookings.requestedStartAt}
    END
  `;
  const effectiveEnd = sql<Date>`
    CASE WHEN ${bookings.status} = 'confirmed'
      THEN COALESCE(${bookings.confirmedEndAt}, ${bookings.requestedEndAt})
      ELSE ${bookings.requestedEndAt}
    END
  `;

  const [blockingBookings, countRows] = await Promise.all([
    executor
      .select({
        id: bookings.id,
        status: bookings.status,
        customerFirstName: bookings.customerFirstName,
        customerLastName: bookings.customerLastName,
        specialistName: specialists.displayName,
        startAt: effectiveStart.mapWith(bookings.requestedStartAt),
        endAt: effectiveEnd.mapWith(bookings.requestedEndAt),
      })
      .from(bookings)
      .innerJoin(specialists, eq(specialists.id, bookings.specialistId))
      .where(
        and(
          eq(bookings.specialistId, input.specialistId),
          bookingBlocksAvailability,
          sql<boolean>`${effectiveStart} < ${candidateEffectiveEnd}`,
          sql<boolean>`
            (${effectiveEnd} + ${input.bufferMinutes} * INTERVAL '1 minute')
            > ${input.startAt}
          `,
        ),
      ),
    executor
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(bookings)
      .where(
        and(
          eq(bookings.specialistId, input.specialistId),
          bookingBlocksAvailability,
          sql<boolean>`${effectiveStart} >= ${dayRange.start}`,
          sql<boolean>`${effectiveStart} < ${dayRange.end}`,
        ),
      ),
  ]);

  const conflicts: AdminBookingConflict[] = blockingBookings.map((booking) => {
    const isActualOverlap =
      booking.startAt < input.endAt && booking.endAt > input.startAt;
    const customerName =
      `${booking.customerFirstName} ${booking.customerLastName}`.trim();
    const period = `${timeFormatter.format(booking.startAt)}–${timeFormatter.format(booking.endAt)}`;

    return {
      type: isActualOverlap ? "booking_overlap" : "booking_buffer",
      bookingId: booking.id,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      message: isActualOverlap
        ? `Kolizja z rezerwacją klienta ${customerName}, ${period} (${booking.specialistName}).`
        : `Termin koliduje z buforem rezerwacji klienta ${customerName}, ${period}.`,
    } satisfies AdminBookingConflict;
  });

  const count = countRows[0]?.count ?? 0;
  if (input.maxBookingsPerDay !== null && count >= input.maxBookingsPerDay) {
    conflicts.push({
      type: "max_bookings_per_day",
      message: `Osiągnięto dzienny limit rezerwacji: ${count}/${input.maxBookingsPerDay}.`,
    });
  }

  return conflicts;
};

const collectSchedulingConflicts = async (input: {
  specialistId: AdminBookingCreateInput["specialistId"];
  date: string;
  startAt: Date;
  endAt: Date;
  bufferMinutes: number;
}): Promise<AdminBookingConflict[]> => {
  const availability = await getSpecialistAvailabilityForDate({
    specialistId: input.specialistId,
    date: input.date,
  });
  const conflicts: AdminBookingConflict[] = [];
  const horizonError = getBookingTimeHorizonError({
    startAt: input.startAt,
    minNoticeMinutes: availability.minNoticeMinutes,
    maxAdvanceDays: availability.maxAdvanceDays,
  });

  if (horizonError === "BOOKING_MIN_NOTICE_NOT_MET") {
    conflicts.push({
      type: "min_notice",
      message: `Termin nie spełnia minimalnego wyprzedzenia ${availability.minNoticeMinutes} min.`,
    });
  } else if (horizonError === "BOOKING_MAX_ADVANCE_EXCEEDED") {
    conflicts.push({
      type: "max_advance",
      message: `Termin przekracza maksymalne wyprzedzenie ${availability.maxAdvanceDays} dni.`,
    });
  }

  const effectiveEndAt = new Date(
    input.endAt.getTime() + input.bufferMinutes * MILLISECONDS_PER_MINUTE,
  );

  if (availability.workingWindows.length === 0) {
    conflicts.push({
      type:
        availability.source === "override"
          ? "date_override_unavailable"
          : "outside_working_hours",
      message:
        availability.source === "override"
          ? "Specjalista jest oznaczony jako niedostępny tego dnia."
          : "Dla tego dnia nie skonfigurowano godzin pracy specjalisty.",
    });
  } else if (
    !availability.workingWindows.some((window) =>
      doesBusyIntervalFitWorkingWindow({
        startAt: input.startAt,
        effectiveEndAt,
        windowStartTime: window.startTime,
        windowEndTime: window.endTime,
      }),
    )
  ) {
    conflicts.push({
      type: "outside_working_hours",
      message: `Termin ${timeFormatter.format(input.startAt)}–${timeFormatter.format(input.endAt)} wraz z buforem wykracza poza godziny pracy: ${availability.workingWindows.map((window) => `${window.startTime.slice(0, 5)}–${window.endTime.slice(0, 5)}`).join(", ")}.`,
    });
  }

  const [databaseConflicts, googleBusyPeriods] = await Promise.all([
    collectDatabaseConflicts(db, {
      ...input,
      maxBookingsPerDay: availability.maxBookingsPerDay,
    }),
    getSpecialistGoogleBusyPeriods({
      specialistId: input.specialistId,
      timeMin: input.startAt,
      timeMax: effectiveEndAt,
    }),
  ]);

  conflicts.push(...databaseConflicts);
  googleBusyPeriods
    .filter((period) =>
      busyPeriodsOverlap(period, input.startAt, effectiveEndAt),
    )
    .forEach((period) => {
      conflicts.push({
        type: "google_busy",
        startAt: period.start.toISOString(),
        endAt: period.end.toISOString(),
        message: `Kalendarz dostępności specjalisty jest zajęty ${dateTimeFormatter.format(period.start)}–${timeFormatter.format(period.end)}.`,
      });
    });

  return conflicts;
};

export const getAdminManualBookingOptions = async () => {
  const [variantRows, specialistRows] = await Promise.all([
    db
      .select({
        massageId: massages.id,
        massageName: massages.name,
        variantCode: massageVariants.code,
        priceGrosze: massageVariants.priceGrosze,
        durationMinutes: massageVariants.durationMinutes,
        durationLabel: massageVariants.durationLabel,
      })
      .from(massageVariants)
      .innerJoin(massages, eq(massageVariants.massageId, massages.id))
      .where(
        and(
          eq(massages.isActive, true),
          eq(massages.bookingAvailable, true),
          eq(massageVariants.isActive, true),
        ),
      )
      .orderBy(massages.name, massageVariants.bookingSlotMinutes),
    db
      .select({ id: specialists.id, name: specialists.displayName })
      .from(specialists)
      .where(eq(specialists.isActive, true))
      .orderBy(specialists.displayName),
  ]);

  return { variants: variantRows, specialists: specialistRows };
};

export const createAdminBooking = async (
  session: AdminSession,
  input: AdminBookingCreateInput,
): Promise<AdminBookingCreateResult> => {
  if (!isOwner(session)) return { success: false, reason: "forbidden" };

  const [existing] = await db
    .select({
      id: bookings.id,
      calendarSyncStatus: bookings.calendarSyncStatus,
    })
    .from(bookings)
    .where(eq(bookings.adminCreationKey, input.adminCreationKey))
    .limit(1);

  if (existing) {
    return {
      success: true,
      bookingId: existing.id,
      alreadyApplied: true,
      calendarSyncStatus: existing.calendarSyncStatus,
    };
  }

  const [selectedVariant, specialist] = await Promise.all([
    getSelectedVariant(db, input.massageId, input.variantCode),
    getActiveSpecialist(db, input.specialistId),
  ]);

  if (!selectedVariant) return { success: false, reason: "variant_not_found" };
  if (
    !selectedVariant.massageIsActive ||
    !selectedVariant.bookingAvailable ||
    !selectedVariant.variantIsActive
  ) {
    return { success: false, reason: "variant_unavailable" };
  }
  if (!specialist) {
    return { success: false, reason: "specialist_unavailable" };
  }

  let selectedAddons: Awaited<ReturnType<typeof resolveBookingAddons>>;
  try {
    selectedAddons = await resolveBookingAddons({
      massageId: input.massageId,
      addonIds: input.addonIds,
    });
  } catch (error) {
    if (error instanceof Error && addonSelectionErrorCodes.has(error.message)) {
      return { success: false, reason: "addon_unavailable" };
    }
    throw error;
  }

  const requestedStartAt = parseWarsawStartAt(input.date, input.time);
  if (!requestedStartAt) {
    return { success: false, reason: "invalid_start_time" };
  }
  const requestedEndAt = new Date(
    requestedStartAt.getTime() +
      (selectedVariant.bookingSlotMinutes + selectedAddons.totalSlotExtensionMinutes) * MILLISECONDS_PER_MINUTE,
  );

  let bufferMinutes: number;
  let conflicts: AdminBookingConflict[];
  try {
    bufferMinutes = await getBookingBufferMinutes();
    conflicts = await collectSchedulingConflicts({
      specialistId: input.specialistId,
      date: input.date,
      startAt: requestedStartAt,
      endAt: requestedEndAt,
      bufferMinutes,
    });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "BOOKING_CONFIGURATION_FAILED";
    if (configurationErrorCodes.has(errorCode)) {
      return { success: false, reason: "configuration_failure", errorCode };
    }
    throw error;
  }

  if (conflicts.length > 0 && !input.overrideConflicts) {
    return { success: false, reason: "requires_override", conflicts };
  }

  type TransactionResult =
    | { kind: "created"; booking: typeof bookings.$inferSelect }
    | { kind: "existing"; booking: Pick<typeof bookings.$inferSelect, "id" | "calendarSyncStatus"> }
    | { kind: "requires_override"; conflicts: AdminBookingConflict[] }
    | { kind: "data_changed" };

  let transactionResult: TransactionResult;
  try {
    transactionResult = await db.transaction(async (tx): Promise<TransactionResult> => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${input.specialistId}:${input.date}`}))`,
      );

      const [idempotentBooking] = await tx
        .select({ id: bookings.id, calendarSyncStatus: bookings.calendarSyncStatus })
        .from(bookings)
        .where(eq(bookings.adminCreationKey, input.adminCreationKey))
        .limit(1);
      if (idempotentBooking) {
        return { kind: "existing", booking: idempotentBooking };
      }

      const [freshVariant, freshSpecialist, freshAddons] = await Promise.all([
        getSelectedVariant(tx, input.massageId, input.variantCode),
        getActiveSpecialist(tx, input.specialistId),
        resolveBookingAddons({
          massageId: input.massageId,
          addonIds: input.addonIds,
          executor: tx,
        }).catch((error: unknown) => {
          if (error instanceof Error && addonSelectionErrorCodes.has(error.message)) return null;
          throw error;
        }),
      ]);
      if (
        !freshVariant ||
        !freshSpecialist ||
        !freshAddons ||
        !freshVariant.massageIsActive ||
        !freshVariant.bookingAvailable ||
        !freshVariant.variantIsActive ||
        freshVariant.variantId !== selectedVariant.variantId ||
        freshVariant.bookingSlotMinutes !== selectedVariant.bookingSlotMinutes ||
        freshVariant.priceGrosze !== selectedVariant.priceGrosze ||
        JSON.stringify(freshAddons.addons) !== JSON.stringify(selectedAddons.addons)
      ) {
        return { kind: "data_changed" };
      }

      const freshDatabaseConflicts = await collectDatabaseConflicts(tx, {
        specialistId: input.specialistId,
        date: input.date,
        startAt: requestedStartAt,
        endAt: requestedEndAt,
        bufferMinutes,
        maxBookingsPerDay:
          (await getSpecialistAvailabilityForDate({
            specialistId: input.specialistId,
            date: input.date,
          })).maxBookingsPerDay,
      });
      const externalConflicts = conflicts.filter(
        (conflict) =>
          conflict.type !== "booking_overlap" &&
          conflict.type !== "booking_buffer" &&
          conflict.type !== "max_bookings_per_day",
      );
      const currentConflicts = [...externalConflicts, ...freshDatabaseConflicts];

      if (currentConflicts.length > 0 && !input.overrideConflicts) {
        return { kind: "requires_override", conflicts: currentConflicts };
      }

      const now = new Date();
      const [booking] = await tx
        .insert(bookings)
        .values({
          status: "confirmed",
          paymentMethod: "on_site",
          paymentStatus: "unpaid",
          source: "admin",
          createdByUsername: session.username,
          createdByRole: session.role,
          availabilityOverride: currentConflicts.length > 0,
          availabilityOverrideReasons:
            currentConflicts.length > 0
              ? currentConflicts.map(({ type, message }) => ({ type, message }))
              : null,
          adminCreationKey: input.adminCreationKey,
          massageId: freshVariant.massageId,
          massageVariantId: freshVariant.variantId,
          massageNameSnapshot: freshVariant.massageName,
          durationMinutesSnapshot: freshVariant.durationMinutes,
          durationLabelSnapshot: freshVariant.durationLabel,
          bookingSlotMinutesSnapshot:
            freshVariant.bookingSlotMinutes + freshAddons.totalSlotExtensionMinutes,
          priceGroszeSnapshot: freshVariant.priceGrosze,
          totalPriceGroszeSnapshot:
            freshVariant.priceGrosze + freshAddons.totalPriceGrosze,
          specialistId: input.specialistId,
          requestedStartAt,
          requestedEndAt,
          confirmedStartAt: requestedStartAt,
          confirmedEndAt: requestedEndAt,
          confirmedAt: now,
          locationType: input.locationType,
          locationVerificationStatus:
            input.locationType === "mobile" ? "pending" : "not_required",
          mobileStreet: input.mobileAddress?.street ?? null,
          mobileBuildingNumber: input.mobileAddress?.buildingNumber ?? null,
          mobileApartmentNumber: input.mobileAddress?.apartmentNumber ?? null,
          mobilePostalCode: input.mobileAddress?.postalCode ?? null,
          mobileCity: input.mobileAddress?.city ?? null,
          customerFirstName: input.customer.firstName,
          customerLastName: input.customer.lastName,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone || null,
          contactByEmail: input.contactByEmail,
          contactByPhone: input.contactByPhone,
          preferredContactTime: input.preferredContactTime ?? null,
          notes: input.notes ?? null,
          termsAcceptedAt: null,
          privacyAcceptedAt: null,
        })
        .returning();

      if (freshAddons.addons.length > 0) {
        await tx.insert(bookingAddons).values(
          freshAddons.addons.map((addon) => ({
            bookingId: booking.id,
            addonId: addon.id,
            nameSnapshot: addon.name,
            descriptionSnapshot: addon.description,
            priceGroszeSnapshot: addon.priceGrosze,
            treatmentDurationMinutesSnapshot: addon.treatmentDurationMinutes,
            slotExtensionMinutesSnapshot: addon.slotExtensionMinutes,
          })),
        );
      }

      return { kind: "created", booking };
    });
  } catch (error) {
    const [idempotentBooking] = await db
      .select({ id: bookings.id, calendarSyncStatus: bookings.calendarSyncStatus })
      .from(bookings)
      .where(eq(bookings.adminCreationKey, input.adminCreationKey))
      .limit(1);
    if (idempotentBooking) {
      return {
        success: true,
        bookingId: idempotentBooking.id,
        alreadyApplied: true,
        calendarSyncStatus: idempotentBooking.calendarSyncStatus,
      };
    }
    throw error;
  }

  if (transactionResult.kind === "requires_override") {
    return {
      success: false,
      reason: "requires_override",
      conflicts: transactionResult.conflicts,
    };
  }
  if (transactionResult.kind === "data_changed") {
    return { success: false, reason: "data_changed" };
  }
  if (transactionResult.kind === "existing") {
    return {
      success: true,
      bookingId: transactionResult.booking.id,
      alreadyApplied: true,
      calendarSyncStatus: transactionResult.booking.calendarSyncStatus,
    };
  }

  const booking = transactionResult.booking;
  try {
    await syncBookingToGoogleCalendar({
      id: booking.id,
      specialistId: input.specialistId,
      massageNameSnapshot: booking.massageNameSnapshot,
      durationMinutesSnapshot: booking.durationMinutesSnapshot,
      durationLabelSnapshot: booking.durationLabelSnapshot,
      requestedStartAt: booking.requestedStartAt,
      requestedEndAt: booking.requestedEndAt,
      locationType: booking.locationType,
      mobileStreet: booking.mobileStreet,
      mobileBuildingNumber: booking.mobileBuildingNumber,
      mobileApartmentNumber: booking.mobileApartmentNumber,
      mobilePostalCode: booking.mobilePostalCode,
      mobileCity: booking.mobileCity,
      customerFirstName: booking.customerFirstName,
      customerLastName: booking.customerLastName,
      customerPhone: booking.customerPhone,
    });
  } catch (error) {
    console.error("Admin booking calendar synchronization state update failed:", {
      bookingId: booking.id,
      error,
    });
  }

  const notificationSent = await attemptBookingCustomerNotification({
    bookingId: booking.id,
    event: "confirmed",
    idempotencyKey: `admin-create:${input.adminCreationKey}`,
  });
  const [syncedBooking] = await db
    .select({ calendarSyncStatus: bookings.calendarSyncStatus })
    .from(bookings)
    .where(eq(bookings.id, booking.id))
    .limit(1);

  return {
    success: true,
    bookingId: booking.id,
    alreadyApplied: false,
    calendarSyncStatus: syncedBooking?.calendarSyncStatus ?? "failed",
    notificationSent,
  };
};
