import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookingAddons, bookings, massages, massageVariants, payments, specialists } from "@/db/schema";
import {
  busyPeriodsOverlap,
  getBookingBusyPeriods,
  getSpecialistDailyBookingCount,
  getSpecialistGoogleBusyPeriods,
} from "./booking.availability";
import { resolveBookingAddons } from "./booking-addons.service";
import { syncBookingToGoogleCalendar } from "./booking-calendar-sync.service";
import { getBookingBufferMinutes } from "./booking-settings.service";
import { assertBookingTimeWindow, getSpecialistAvailabilitySettings } from "./booking-time-window.service";
import { getBookingZonedDateTime, MILLISECONDS_PER_MINUTE } from "./booking-time-zone";
import { BOOKING_PAYMENT_HOLD_MINUTES } from "@/server/payments/booking-payment.config";

import type { CreateBookingInput } from "./booking.types";

export const createBooking = async (input: CreateBookingInput, origin: string) => {
  const [selectedVariant] = await db
    .select({
      massageId: massages.id,
      massageName: massages.name,
      massageIsActive: massages.isActive,
      bookingAvailable: massages.bookingAvailable,

      variantId: massageVariants.id,
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
        eq(massages.id, input.massageId),
        eq(massageVariants.code, input.variantCode),
      ),
    )
    .limit(1);

  if (!selectedVariant) {
    throw new Error("BOOKING_VARIANT_NOT_FOUND");
  }

  if (
    !selectedVariant.massageIsActive ||
    !selectedVariant.bookingAvailable ||
    !selectedVariant.variantIsActive
  ) {
    throw new Error("BOOKING_VARIANT_UNAVAILABLE");
  }

  const [specialist] = await db
    .select({
      id: specialists.id,
      isActive: specialists.isActive,
    })
    .from(specialists)
    .where(eq(specialists.id, input.specialistId))
    .limit(1);

  if (!specialist || !specialist.isActive) {
    throw new Error("BOOKING_SPECIALIST_UNAVAILABLE");
  }

  const selectedAddons = await resolveBookingAddons({
    massageId: input.massageId,
    addonIds: input.addonIds,
  });

  if (input.paymentMethod === "online" && selectedVariant.priceGrosze + selectedAddons.totalPriceGrosze <= 0) {
    throw new Error("BOOKING_INVALID_PRICE");
  }

  const requestedStartAt = new Date(input.startAt);

  if (Number.isNaN(requestedStartAt.getTime())) {
    throw new Error("BOOKING_INVALID_START_TIME");
  }

  const requestedEndAt = new Date(
    requestedStartAt.getTime() +
      (selectedVariant.bookingSlotMinutes + selectedAddons.totalSlotExtensionMinutes) * 60_000,
  );
  const bufferMinutes = await getBookingBufferMinutes();
  const date = getBookingZonedDateTime(requestedStartAt).dateKey;
  const candidateEffectiveEnd = new Date(requestedEndAt.getTime() + bufferMinutes * MILLISECONDS_PER_MINUTE);

  await assertBookingTimeWindow({
    specialistId: input.specialistId,
    startAt: requestedStartAt,
    endAt: requestedEndAt,
    bufferMinutes,
  });
  const availabilitySettings = await getSpecialistAvailabilitySettings(input.specialistId);
  const googleBusy = await getSpecialistGoogleBusyPeriods({
    specialistId: input.specialistId,
    timeMin: requestedStartAt,
    timeMax: candidateEffectiveEnd,
  });
  if (googleBusy.some((period) => busyPeriodsOverlap(period, requestedStartAt, candidateEffectiveEnd))) {
    throw new Error("BOOKING_SLOT_UNAVAILABLE");
  }

  if (input.locationType === "mobile" && !input.mobileAddress) {
    throw new Error("BOOKING_MOBILE_ADDRESS_REQUIRED");
  }

  if (!input.contactByEmail && !input.contactByPhone) {
    throw new Error("BOOKING_CONTACT_METHOD_REQUIRED");
  }

  if (!input.termsAccepted || !input.privacyAccepted) {
    throw new Error("BOOKING_CONSENT_REQUIRED");
  }

  const locationVerificationStatus =
    input.locationType === "mobile" ? "pending" : "not_required";

  const result = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${input.specialistId}:${date}`}))`,
    );

    const [existing] = await transaction
      .select({
        id: bookings.id,
        status: bookings.status,
        createdAt: bookings.createdAt,
        paymentMethod: bookings.paymentMethod,
        paymentStatus: bookings.paymentStatus,
        massageId: bookings.massageId,
        variantId: bookings.massageVariantId,
        specialistId: bookings.specialistId,
        requestedStartAt: bookings.requestedStartAt,
        customerEmail: bookings.customerEmail,
      })
      .from(bookings)
      .where(eq(bookings.publicCreationKey, input.publicCreationKey))
      .limit(1);
    if (existing) {
      const existingAddons = await transaction
        .select({ addonId: bookingAddons.addonId })
        .from(bookingAddons)
        .where(eq(bookingAddons.bookingId, existing.id));
      if (existing.paymentMethod !== input.paymentMethod ||
        existing.massageId !== input.massageId ||
        existing.variantId !== selectedVariant.variantId ||
        existing.specialistId !== input.specialistId ||
        existing.requestedStartAt.getTime() !== requestedStartAt.getTime() ||
        existing.customerEmail !== input.customer.email ||
        JSON.stringify(existingAddons.map(({ addonId }) => addonId).sort()) !== JSON.stringify([...input.addonIds].sort())) {
        throw new Error("BOOKING_IDEMPOTENCY_CONFLICT");
      }
      return { booking: existing, alreadyCreated: true } as const;
    }

    // All public writers use this specialist/day lock. Recheck after acquiring it,
    // so a concurrent hold or owner booking cannot slip between check and insert.
    const [freshVariant] = await transaction
      .select({
        id: massageVariants.id,
        price: massageVariants.priceGrosze,
        slot: massageVariants.bookingSlotMinutes,
        active: massageVariants.isActive,
        massageActive: massages.isActive,
        available: massages.bookingAvailable,
      })
      .from(massageVariants)
      .innerJoin(massages, eq(massageVariants.massageId, massages.id))
      .where(eq(massageVariants.id, selectedVariant.variantId))
      .limit(1);
    const [freshSpecialist] = await transaction
      .select({ active: specialists.isActive })
      .from(specialists)
      .where(eq(specialists.id, input.specialistId))
      .limit(1);
    const freshAddons = await resolveBookingAddons({
      massageId: input.massageId,
      addonIds: input.addonIds,
      executor: transaction,
    });
    if (!freshVariant || !freshVariant.active || !freshVariant.massageActive || !freshVariant.available ||
      freshVariant.price !== selectedVariant.priceGrosze ||
      freshVariant.slot !== selectedVariant.bookingSlotMinutes ||
      !freshSpecialist?.active ||
      JSON.stringify(freshAddons.addons) !== JSON.stringify(selectedAddons.addons)) {
      throw new Error("BOOKING_DATA_CHANGED");
    }
    if (availabilitySettings.maxBookingsPerDay !== null) {
      const bookingCount = await getSpecialistDailyBookingCount({
        specialistId: input.specialistId,
        date,
        executor: transaction,
      });
      if (bookingCount >= availabilitySettings.maxBookingsPerDay) {
        throw new Error("BOOKING_SLOT_UNAVAILABLE");
      }
    }
    const bookingBusy = await getBookingBusyPeriods({
      specialistId: input.specialistId,
      timeMin: requestedStartAt,
      timeMax: candidateEffectiveEnd,
      bufferMinutes,
      executor: transaction,
    });
    if (bookingBusy.some((period) => busyPeriodsOverlap(period, requestedStartAt, candidateEffectiveEnd))) {
      throw new Error("BOOKING_SLOT_UNAVAILABLE");
    }

    const now = new Date();
    const paymentExpiresAt = input.paymentMethod === "online"
      ? new Date(now.getTime() + BOOKING_PAYMENT_HOLD_MINUTES * 60_000)
      : null;

    const [createdBooking] = await transaction
    .insert(bookings)
    .values({
      status: "pending",
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentMethod === "online" ? "pending" : "unpaid",
      paymentExpiresAt,
      publicCreationKey: input.publicCreationKey,

      massageId: selectedVariant.massageId,
      massageVariantId: selectedVariant.variantId,

      massageNameSnapshot: selectedVariant.massageName,

      durationMinutesSnapshot: selectedVariant.durationMinutes,

      durationLabelSnapshot: selectedVariant.durationLabel,

      bookingSlotMinutesSnapshot:
        selectedVariant.bookingSlotMinutes + selectedAddons.totalSlotExtensionMinutes,

      priceGroszeSnapshot: selectedVariant.priceGrosze,

      totalPriceGroszeSnapshot:
        selectedVariant.priceGrosze + selectedAddons.totalPriceGrosze,

      specialistId: input.specialistId,

      requestedStartAt,
      requestedEndAt,

      confirmedStartAt: null,
      confirmedEndAt: null,

      locationType: input.locationType,
      locationVerificationStatus,

      mobileStreet: input.mobileAddress?.street ?? null,

      mobileBuildingNumber: input.mobileAddress?.buildingNumber ?? null,

      mobileApartmentNumber: input.mobileAddress?.apartmentNumber ?? null,

      mobilePostalCode: input.mobileAddress?.postalCode ?? null,

      mobileCity: input.mobileAddress?.city ?? null,

      customerFirstName: input.customer.firstName,

      customerLastName: input.customer.lastName,

      customerEmail: input.customer.email,

      customerPhone: input.customer.phone,

      contactByEmail: input.contactByEmail,

      contactByPhone: input.contactByPhone,

      preferredContactTime: input.preferredContactTime ?? null,

      notes: input.notes ?? null,

      termsAcceptedAt: now,
      privacyAcceptedAt: now,
    })
    .returning({
      id: bookings.id,
      status: bookings.status,
      createdAt: bookings.createdAt,
      paymentMethod: bookings.paymentMethod,
      paymentStatus: bookings.paymentStatus,
      specialistId: bookings.specialistId,
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
    });

    if (selectedAddons.addons.length > 0) {
      await transaction.insert(bookingAddons).values(
        selectedAddons.addons.map((addon) => ({
          bookingId: createdBooking.id,
          addonId: addon.id,
          nameSnapshot: addon.name,
          descriptionSnapshot: addon.description,
          priceGroszeSnapshot: addon.priceGrosze,
          treatmentDurationMinutesSnapshot: addon.treatmentDurationMinutes,
          slotExtensionMinutesSnapshot: addon.slotExtensionMinutes,
        })),
      );
    }

    return { booking: createdBooking, alreadyCreated: false } as const;
  });

  const { booking, alreadyCreated } = result;

  if (booking.paymentMethod === "online") {
    const [existingPayment] = await db
      .select({ checkoutSessionId: payments.providerCheckoutSessionId })
      .from(payments)
      .where(eq(payments.bookingId, booking.id))
      .limit(1);
    if (existingPayment) {
      const { stripe } = await import("@/server/payments/stripe.service");
      const session = await stripe.checkout.sessions.retrieve(existingPayment.checkoutSessionId);
      if (session.url && session.status === "open") {
        return { id: booking.id, status: booking.status, checkoutUrl: session.url };
      }
      throw new Error("BOOKING_PAYMENT_SESSION_UNAVAILABLE");
    }
    if (booking.paymentStatus === "failed") throw new Error("BOOKING_PAYMENT_SESSION_UNAVAILABLE");
    if (alreadyCreated) throw new Error("BOOKING_PAYMENT_PROCESSING");

    try {
      const { createBookingCheckout } = await import("@/server/payments/booking-checkout.service");
      const checkoutUrl = await createBookingCheckout({ bookingId: booking.id, origin });
      return { id: booking.id, status: booking.status, checkoutUrl };
    } catch (error) {
      await db.update(bookings).set({ paymentStatus: "failed", paymentExpiresAt: new Date(), updatedAt: new Date() })
        .where(and(eq(bookings.id, booking.id), eq(bookings.paymentStatus, "pending")));
      throw new Error("BOOKING_CHECKOUT_FAILED", { cause: error });
    }
  }

  if (result.alreadyCreated) {
    return { id: booking.id, status: booking.status, createdAt: booking.createdAt };
  }

  try {
    await syncBookingToGoogleCalendar({
      ...result.booking,
      specialistId: input.specialistId,
    });
  } catch (error) {
    console.error("Booking calendar synchronization state update failed:", {
      bookingId: booking.id,
      error,
    });
  }

  return {
    id: booking.id,
    status: booking.status,
    createdAt: booking.createdAt,
  };
};
