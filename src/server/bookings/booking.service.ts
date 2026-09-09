import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookings, massages, massageVariants, specialists } from "@/db/schema";
import { assertBookingSlotAvailable } from "./booking.availability";
import { syncBookingToGoogleCalendar } from "./booking-calendar-sync.service";

import type { CreateBookingInput } from "./booking.types";

export const createBooking = async (input: CreateBookingInput) => {
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

  const requestedStartAt = new Date(input.startAt);

  if (Number.isNaN(requestedStartAt.getTime())) {
    throw new Error("BOOKING_INVALID_START_TIME");
  }

  const requestedEndAt = new Date(
    requestedStartAt.getTime() + selectedVariant.bookingSlotMinutes * 60_000,
  );

  await assertBookingSlotAvailable({
    specialistId: input.specialistId,
    startAt: requestedStartAt,
    endAt: requestedEndAt,
  });

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

  const now = new Date();

  const [booking] = await db
    .insert(bookings)
    .values({
      status: "pending",

      massageId: selectedVariant.massageId,
      massageVariantId: selectedVariant.variantId,

      massageNameSnapshot: selectedVariant.massageName,

      durationMinutesSnapshot: selectedVariant.durationMinutes,

      durationLabelSnapshot: selectedVariant.durationLabel,

      bookingSlotMinutesSnapshot: selectedVariant.bookingSlotMinutes,

      priceGroszeSnapshot: selectedVariant.priceGrosze,

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

  try {
    await syncBookingToGoogleCalendar({
      ...booking,
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
