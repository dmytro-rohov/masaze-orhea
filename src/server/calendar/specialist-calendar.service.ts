import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { specialistCalendars } from "@/db/schema";

import type { BookingSpecialistId } from "../bookings/booking.types";

export const getSpecialistCalendarId = async (
  specialistId: BookingSpecialistId,
): Promise<string> => {
  const [calendar] = await db
    .select({
      googleCalendarId: specialistCalendars.googleCalendarId,
    })
    .from(specialistCalendars)
    .where(
      and(
        eq(specialistCalendars.specialistId, specialistId),
        eq(specialistCalendars.isActive, true),
      ),
    )
    .limit(1);

  if (!calendar) {
    throw new Error("SPECIALIST_CALENDAR_NOT_FOUND");
  }

  return calendar.googleCalendarId;
};
