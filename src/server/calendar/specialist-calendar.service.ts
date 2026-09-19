import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { specialistCalendars } from "@/db/schema";

import type { BookingSpecialistId } from "../bookings/booking.types";

export type SpecialistCalendarPurpose = "availability" | "bookings";

const missingCalendarErrorByPurpose: Record<
  SpecialistCalendarPurpose,
  string
> = {
  availability: "SPECIALIST_AVAILABILITY_CALENDAR_NOT_FOUND",
  bookings: "SPECIALIST_BOOKING_CALENDAR_NOT_FOUND",
};

export const getSpecialistCalendarId = async (
  specialistId: BookingSpecialistId,
  purpose: SpecialistCalendarPurpose,
): Promise<string> => {
  const [calendar] = await db
    .select({
      googleCalendarId: specialistCalendars.googleCalendarId,
    })
    .from(specialistCalendars)
    .where(
      and(
        eq(specialistCalendars.specialistId, specialistId),
        eq(specialistCalendars.purpose, purpose),
        eq(specialistCalendars.isActive, true),
      ),
    )
    .limit(1);

  if (!calendar) {
    throw new Error(missingCalendarErrorByPurpose[purpose]);
  }

  return calendar.googleCalendarId;
};

export const getSpecialistAvailabilityCalendarId = (
  specialistId: BookingSpecialistId,
): Promise<string> => getSpecialistCalendarId(specialistId, "availability");

export const getSpecialistBookingCalendarId = (
  specialistId: BookingSpecialistId,
): Promise<string> => getSpecialistCalendarId(specialistId, "bookings");
