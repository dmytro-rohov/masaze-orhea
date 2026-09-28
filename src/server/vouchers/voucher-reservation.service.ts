import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  bookingAddons,
  bookings,
  specialists,
  voucherEvents,
  voucherOrderAddons,
  vouchers,
} from "@/db/schema";
import {
  busyPeriodsOverlap,
  getBookingBusyPeriods,
  getSpecialistDailyBookingCount,
  getSpecialistGoogleBusyPeriods,
} from "@/server/bookings/booking.availability";
import { getBookingBufferMinutes } from "@/server/bookings/booking-settings.service";
import { syncBookingToGoogleCalendar } from "@/server/bookings/booking-calendar-sync.service";
import { resolveVoucherExtraAddons } from "@/server/bookings/booking-addons.service";
import {
  assertBookingTimeWindow,
  getSpecialistAvailabilitySettings,
} from "@/server/bookings/booking-time-window.service";
import {
  getBookingZonedDateTime,
  MILLISECONDS_PER_MINUTE,
} from "@/server/bookings/booking-time-zone";
import type {
  BookingLocationType,
  BookingPreferredContactTime,
  BookingSpecialistId,
} from "@/server/bookings/booking.types";

import { hashVoucherBookingToken } from "./voucher-issuance.service";

type VoucherReservationExecutor = Pick<typeof db, "select" | "insert" | "update">;

export type PublicVoucherBookingAddon = {
  id: string;
  name: string;
  description: string | null;
  priceGrosze: number;
  treatmentDurationMinutes: number | null;
  slotExtensionMinutes: number;
};

export type PublicVoucherBooking = {
  state: "active" | "reserved";
  massageId: string;
  massageVariantId: string;
  massageName: string;
  durationMinutes: number | null;
  durationLabel: string | null;
  bookingSlotMinutes: number;
  addons: PublicVoucherBookingAddon[];
  expiresAt: Date;
};

export type VoucherReservationBookingInput = {
  publicCreationKey: string;
  specialistId: BookingSpecialistId;
  startAt: string;
  locationType: BookingLocationType;
  mobileAddress?: {
    street: string;
    buildingNumber: string;
    apartmentNumber?: string;
    postalCode: string;
    city: string;
  };
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  contactByEmail: boolean;
  contactByPhone: boolean;
  preferredContactTime?: BookingPreferredContactTime;
  notes?: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  extraAddonIds?: string[];
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isBookableVoucherStatus = (status: string): status is "active" | "reserved" =>
  status === "active" || status === "reserved";

const getPublicVoucherBooking = async (
  where: ReturnType<typeof eq>,
): Promise<PublicVoucherBooking> => {
  const [voucher] = await db
    .select({
      id: vouchers.id,
      voucherOrderId: vouchers.voucherOrderId,
      status: vouchers.status,
      voucherType: vouchers.voucherType,
      massageId: vouchers.massageId,
      massageVariantId: vouchers.massageVariantId,
      massageName: vouchers.massageNameSnapshot,
      durationMinutes: vouchers.durationMinutesSnapshot,
      durationLabel: vouchers.durationLabelSnapshot,
      bookingSlotMinutes: vouchers.bookingSlotMinutesSnapshot,
      expiresAt: vouchers.expiresAt,
    })
    .from(vouchers)
    .where(where)
    .limit(1);

  if (!voucher) {
    throw new Error("VOUCHER_BOOKING_NOT_FOUND");
  }

  if (voucher.expiresAt <= new Date()) {
    throw new Error("VOUCHER_BOOKING_EXPIRED");
  }

  if (voucher.status === "cancelled") {
    throw new Error("VOUCHER_BOOKING_CANCELLED");
  }

  if (!isBookableVoucherStatus(voucher.status) || voucher.voucherType !== "service" ||
    !voucher.massageId || !voucher.massageVariantId || !voucher.bookingSlotMinutes) {
    throw new Error("VOUCHER_BOOKING_UNAVAILABLE");
  }

  const addons = await db
    .select({
      id: voucherOrderAddons.addonId,
      name: voucherOrderAddons.nameSnapshot,
      description: voucherOrderAddons.descriptionSnapshot,
      priceGrosze: voucherOrderAddons.priceGroszeSnapshot,
      treatmentDurationMinutes: voucherOrderAddons.treatmentDurationMinutesSnapshot,
      slotExtensionMinutes: voucherOrderAddons.slotExtensionMinutesSnapshot,
    })
    .from(voucherOrderAddons)
    .where(eq(voucherOrderAddons.voucherOrderId, voucher.voucherOrderId))
    .orderBy(voucherOrderAddons.createdAt, voucherOrderAddons.addonId);

  return {
    state: voucher.status,
    massageId: voucher.massageId,
    massageVariantId: voucher.massageVariantId,
    massageName: voucher.massageName ?? "Usługa ORHEA",
    durationMinutes: voucher.durationMinutes,
    durationLabel: voucher.durationLabel,
    bookingSlotMinutes: voucher.bookingSlotMinutes,
    addons,
    expiresAt: voucher.expiresAt,
  };
};

export const resolveVoucherBookingByToken = async (
  token: string,
): Promise<PublicVoucherBooking> => {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    throw new Error("VOUCHER_BOOKING_NOT_FOUND");
  }

  return getPublicVoucherBooking(eq(vouchers.bookingTokenHash, hashVoucherBookingToken(token)));
};

export const resolveVoucherBookingByCode = async (
  code: string,
): Promise<PublicVoucherBooking> => {
  const normalizedCode = code.trim().toUpperCase();
  if (!/^ORHEA-[A-Z0-9-]{8,80}$/.test(normalizedCode)) {
    throw new Error("VOUCHER_BOOKING_NOT_FOUND");
  }

  return getPublicVoucherBooking(eq(vouchers.code, normalizedCode));
};

const assertVoucherReservationInput = (input: VoucherReservationBookingInput) => {
  if (!uuidPattern.test(input.publicCreationKey)) {
    throw new Error("VOUCHER_BOOKING_INVALID_INPUT");
  }
  if (input.specialistId !== "adrian" && input.specialistId !== "aleksandra") {
    throw new Error("VOUCHER_BOOKING_INVALID_INPUT");
  }
  if (!input.contactByEmail && !input.contactByPhone) {
    throw new Error("VOUCHER_BOOKING_CONTACT_METHOD_REQUIRED");
  }
  if (!input.termsAccepted || !input.privacyAccepted) {
    throw new Error("VOUCHER_BOOKING_CONSENT_REQUIRED");
  }
  if (!input.customer.firstName.trim() || !input.customer.lastName.trim() || !input.customer.email.trim()) {
    throw new Error("VOUCHER_BOOKING_INVALID_INPUT");
  }
  if (input.locationType !== "salon" && input.locationType !== "mobile") {
    throw new Error("VOUCHER_BOOKING_INVALID_INPUT");
  }
  if (input.locationType === "mobile" && !input.mobileAddress) {
    throw new Error("VOUCHER_BOOKING_MOBILE_ADDRESS_REQUIRED");
  }
};

export const reserveVoucherForBooking = async ({
  voucherId,
  input,
}: {
  voucherId: string;
  input: VoucherReservationBookingInput;
}) => {
  assertVoucherReservationInput(input);

  const requestedStartAt = new Date(input.startAt);
  if (Number.isNaN(requestedStartAt.getTime())) {
    throw new Error("VOUCHER_BOOKING_INVALID_START_TIME");
  }

  const [specialist] = await db
    .select({ id: specialists.id, isActive: specialists.isActive })
    .from(specialists)
    .where(eq(specialists.id, input.specialistId))
    .limit(1);
  if (!specialist?.isActive) {
    throw new Error("BOOKING_SPECIALIST_UNAVAILABLE");
  }

  const bufferMinutes = await getBookingBufferMinutes();
  const availabilitySettings = await getSpecialistAvailabilitySettings(input.specialistId);
  const date = getBookingZonedDateTime(requestedStartAt).dateKey;

  const result = await db.transaction(async (tx) => {
    const [voucher] = await tx
      .select({
        id: vouchers.id,
        voucherOrderId: vouchers.voucherOrderId,
        status: vouchers.status,
        voucherType: vouchers.voucherType,
        massageId: vouchers.massageId,
        massageVariantId: vouchers.massageVariantId,
        massageName: vouchers.massageNameSnapshot,
        durationMinutes: vouchers.durationMinutesSnapshot,
        durationLabel: vouchers.durationLabelSnapshot,
        bookingSlotMinutes: vouchers.bookingSlotMinutesSnapshot,
        priceGrosze: vouchers.priceGroszeSnapshot,
        amountGrosze: vouchers.amountGrosze,
        currency: vouchers.currency,
        issuedAt: vouchers.issuedAt,
        expiresAt: vouchers.expiresAt,
      })
      .from(vouchers)
      .where(eq(vouchers.id, voucherId))
      .for("update")
      .limit(1);

    if (!voucher) throw new Error("VOUCHER_BOOKING_NOT_FOUND");
    if (voucher.expiresAt <= new Date()) throw new Error("VOUCHER_BOOKING_EXPIRED");
    if (voucher.status !== "active") throw new Error("VOUCHER_BOOKING_ALREADY_RESERVED");
    if (voucher.voucherType !== "service" || !voucher.massageId || !voucher.massageVariantId ||
      !voucher.bookingSlotMinutes || voucher.priceGrosze === null) {
      throw new Error("VOUCHER_BOOKING_UNAVAILABLE");
    }

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${input.specialistId}:${date}`}))`,
    );

    const [freshSpecialist] = await tx
      .select({ isActive: specialists.isActive })
      .from(specialists)
      .where(eq(specialists.id, input.specialistId))
      .limit(1);
    if (!freshSpecialist?.isActive) {
      throw new Error("BOOKING_SPECIALIST_UNAVAILABLE");
    }

    const [existing] = await tx
      .select({ id: bookings.id, voucherId: bookings.voucherId })
      .from(bookings)
      .where(eq(bookings.publicCreationKey, input.publicCreationKey))
      .limit(1);
    if (existing) {
      if (existing.voucherId === voucher.id) {
        return { bookingId: existing.id, voucherId: voucher.id, alreadyReserved: true };
      }
      throw new Error("BOOKING_IDEMPOTENCY_CONFLICT");
    }

    const selectedAddons = await tx
      .select({
        addonId: voucherOrderAddons.addonId,
        name: voucherOrderAddons.nameSnapshot,
        description: voucherOrderAddons.descriptionSnapshot,
        priceGrosze: voucherOrderAddons.priceGroszeSnapshot,
        treatmentDurationMinutes: voucherOrderAddons.treatmentDurationMinutesSnapshot,
        slotExtensionMinutes: voucherOrderAddons.slotExtensionMinutesSnapshot,
      })
      .from(voucherOrderAddons)
      .where(eq(voucherOrderAddons.voucherOrderId, voucher.voucherOrderId));

    const extraAddons = await resolveVoucherExtraAddons({
      massageId: voucher.massageId,
      includedAddonIds: selectedAddons.map((addon) => addon.addonId),
      addonIds: input.extraAddonIds ?? [],
      executor: tx,
    });

    // Task 6 will create the payment/hold for these extras. Until then the
    // request is intentionally rejected after full authoritative validation.
    if (extraAddons.totalPriceGrosze > 0) {
      throw new Error("VOUCHER_TOP_UP_PAYMENT_REQUIRED");
    }

    const slotExtensionMinutes = selectedAddons.reduce(
      (sum, addon) => sum + addon.slotExtensionMinutes,
      0,
    );
    const addonsTotalGrosze = selectedAddons.reduce(
      (sum, addon) => sum + addon.priceGrosze,
      0,
    );
    const requestedEndAt = new Date(
      requestedStartAt.getTime() +
        (voucher.bookingSlotMinutes + slotExtensionMinutes) * MILLISECONDS_PER_MINUTE,
    );
    const candidateEffectiveEnd = new Date(
      requestedEndAt.getTime() + bufferMinutes * MILLISECONDS_PER_MINUTE,
    );

    await assertBookingTimeWindow({
      specialistId: input.specialistId,
      startAt: requestedStartAt,
      endAt: requestedEndAt,
      bufferMinutes,
    });

    if (availabilitySettings.maxBookingsPerDay !== null) {
      const count = await getSpecialistDailyBookingCount({
        specialistId: input.specialistId,
        date,
        executor: tx,
      });
      if (count >= availabilitySettings.maxBookingsPerDay) {
        throw new Error("BOOKING_SLOT_UNAVAILABLE");
      }
    }

    const bookingBusy = await getBookingBusyPeriods({
      specialistId: input.specialistId,
      timeMin: requestedStartAt,
      timeMax: candidateEffectiveEnd,
      bufferMinutes,
      executor: tx,
    });
    if (bookingBusy.some((period) => busyPeriodsOverlap(period, requestedStartAt, candidateEffectiveEnd))) {
      throw new Error("BOOKING_SLOT_UNAVAILABLE");
    }

    const googleBusy = await getSpecialistGoogleBusyPeriods({
      specialistId: input.specialistId,
      timeMin: requestedStartAt,
      timeMax: candidateEffectiveEnd,
    });
    if (googleBusy.some((period) => busyPeriodsOverlap(period, requestedStartAt, candidateEffectiveEnd))) {
      throw new Error("BOOKING_SLOT_UNAVAILABLE");
    }

    const now = new Date();
    const [booking] = await tx
      .insert(bookings)
      .values({
        status: "pending",
        source: "public",
        voucherId: voucher.id,
        paymentMethod: "voucher",
        paymentStatus: "paid",
        paymentPaidAt: voucher.issuedAt,
        paymentExpiresAt: null,
        publicCreationKey: input.publicCreationKey,
        massageId: voucher.massageId,
        massageVariantId: voucher.massageVariantId,
        massageNameSnapshot: voucher.massageName ?? "Usługa ORHEA",
        durationMinutesSnapshot: voucher.durationMinutes,
        durationLabelSnapshot: voucher.durationLabel,
        bookingSlotMinutesSnapshot: voucher.bookingSlotMinutes + slotExtensionMinutes,
        priceGroszeSnapshot: voucher.priceGrosze,
        totalPriceGroszeSnapshot: voucher.priceGrosze + addonsTotalGrosze,
        voucherTopUpAmountGrosze: 0,
        specialistId: input.specialistId,
        requestedStartAt,
        requestedEndAt,
        locationType: input.locationType,
        locationVerificationStatus: input.locationType === "mobile" ? "pending" : "not_required",
        mobileStreet: input.mobileAddress?.street ?? null,
        mobileBuildingNumber: input.mobileAddress?.buildingNumber ?? null,
        mobileApartmentNumber: input.mobileAddress?.apartmentNumber ?? null,
        mobilePostalCode: input.mobileAddress?.postalCode ?? null,
        mobileCity: input.mobileAddress?.city ?? null,
        customerFirstName: input.customer.firstName.trim(),
        customerLastName: input.customer.lastName.trim(),
        customerEmail: input.customer.email.trim().toLowerCase(),
        customerPhone: input.customer.phone.trim(),
        contactByEmail: input.contactByEmail,
        contactByPhone: input.contactByPhone,
        preferredContactTime: input.preferredContactTime ?? null,
        notes: input.notes?.trim() || null,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
      })
      .returning({ id: bookings.id });

    if (!booking) throw new Error("VOUCHER_BOOKING_CREATE_FAILED");

    if (selectedAddons.length > 0) {
      await tx.insert(bookingAddons).values(selectedAddons.map((addon) => ({
        bookingId: booking.id,
        addonId: addon.addonId,
        coverage: "voucher" as const,
        nameSnapshot: addon.name,
        descriptionSnapshot: addon.description,
        priceGroszeSnapshot: addon.priceGrosze,
        treatmentDurationMinutesSnapshot: addon.treatmentDurationMinutes,
        slotExtensionMinutesSnapshot: addon.slotExtensionMinutes,
      })));
    }

    await tx.update(vouchers).set({ status: "reserved", updatedAt: now })
      .where(and(eq(vouchers.id, voucher.id), eq(vouchers.status, "active")));
    await tx.insert(voucherEvents).values({
      voucherId: voucher.id,
      eventType: "reserved",
      createdAt: now,
    });

    return { bookingId: booking.id, voucherId: voucher.id, alreadyReserved: false };
  });

  // A calendar failure must never roll back the atomic voucher reservation.
  // The sync service records the retryable failure state on the booking.
  if (!result.alreadyReserved) {
    const [bookingForCalendar] = await db
      .select({
        id: bookings.id,
        massageNameSnapshot: bookings.massageNameSnapshot,
        durationMinutesSnapshot: bookings.durationMinutesSnapshot,
        durationLabelSnapshot: bookings.durationLabelSnapshot,
        requestedStartAt: bookings.requestedStartAt,
        requestedEndAt: bookings.requestedEndAt,
        locationType: bookings.locationType,
        mobileStreet: bookings.mobileStreet,
        mobileBuildingNumber: bookings.mobileBuildingNumber,
        mobileApartmentNumber: bookings.mobileApartmentNumber,
        mobilePostalCode: bookings.mobilePostalCode,
        mobileCity: bookings.mobileCity,
        customerFirstName: bookings.customerFirstName,
        customerLastName: bookings.customerLastName,
        customerPhone: bookings.customerPhone,
        specialistId: bookings.specialistId,
      })
      .from(bookings)
      .where(eq(bookings.id, result.bookingId))
      .limit(1);

    if (
      bookingForCalendar &&
      (bookingForCalendar.specialistId === "adrian" ||
        bookingForCalendar.specialistId === "aleksandra")
    ) {
      try {
        await syncBookingToGoogleCalendar({
          ...bookingForCalendar,
          specialistId: bookingForCalendar.specialistId,
        });
      } catch (error) {
        console.error("Voucher booking calendar synchronization state update failed:", {
          bookingId: result.bookingId,
          error,
        });
      }
    }
  }

  return result;
};

const getVoucherIdForBookingToken = async (token: string): Promise<string> => {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    throw new Error("VOUCHER_BOOKING_NOT_FOUND");
  }
  const [voucher] = await db
    .select({ id: vouchers.id })
    .from(vouchers)
    .where(eq(vouchers.bookingTokenHash, hashVoucherBookingToken(token)))
    .limit(1);
  if (!voucher) throw new Error("VOUCHER_BOOKING_NOT_FOUND");
  return voucher.id;
};

const getVoucherIdForBookingCode = async (code: string): Promise<string> => {
  const normalizedCode = code.trim().toUpperCase();
  if (!/^ORHEA-[A-Z0-9-]{8,80}$/.test(normalizedCode)) {
    throw new Error("VOUCHER_BOOKING_NOT_FOUND");
  }
  const [voucher] = await db
    .select({ id: vouchers.id })
    .from(vouchers)
    .where(eq(vouchers.code, normalizedCode))
    .limit(1);
  if (!voucher) throw new Error("VOUCHER_BOOKING_NOT_FOUND");
  return voucher.id;
};

// Public callers retain the credential (token or code); the internal voucher
// UUID is never required from the browser to create the reservation.
export const reserveVoucherForBookingToken = async (
  token: string,
  input: VoucherReservationBookingInput,
) => reserveVoucherForBooking({ voucherId: await getVoucherIdForBookingToken(token), input });

export const reserveVoucherForBookingCode = async (
  code: string,
  input: VoucherReservationBookingInput,
) => reserveVoucherForBooking({ voucherId: await getVoucherIdForBookingCode(code), input });

export const releaseVoucherReservationForBooking = async ({
  voucherId,
  actorUsername,
  actorRole,
  executor = db,
}: {
  voucherId: string;
  actorUsername: string | null;
  actorRole: string | null;
  executor?: VoucherReservationExecutor;
}): Promise<"released" | "expired" | "unchanged"> => {
  const [voucher] = await executor
    .select({ id: vouchers.id, status: vouchers.status, expiresAt: vouchers.expiresAt })
    .from(vouchers)
    .where(eq(vouchers.id, voucherId))
    .for("update")
    .limit(1);

  if (!voucher || voucher.status !== "reserved") return "unchanged";

  const now = new Date();
  if (voucher.expiresAt <= now) {
    await executor.update(vouchers).set({ status: "expired", updatedAt: now })
      .where(eq(vouchers.id, voucher.id));
    return "expired";
  }

  await executor.update(vouchers).set({ status: "active", updatedAt: now })
    .where(eq(vouchers.id, voucher.id));
  await executor.insert(voucherEvents).values({
    voucherId: voucher.id,
    eventType: "released",
    actorUsername,
    actorRole,
    createdAt: now,
  });
  return "released";
};
