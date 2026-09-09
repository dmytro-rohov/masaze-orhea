import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookings } from "@/db/schema";

import { getGoogleBusyPeriods } from "../calendar/google-calendar.service";
import { getSpecialistCalendarId } from "../calendar/specialist-calendar.service";

import type { BookingSpecialistId } from "./booking.types";

type AssertBookingSlotAvailableInput = {
  specialistId: BookingSpecialistId;
  startAt: Date;
  endAt: Date;
  bufferMinutes: number;
};

export const assertBookingSlotAvailable = async ({
  specialistId,
  startAt,
  endAt,
  bufferMinutes,
}: AssertBookingSlotAvailableInput) => {
  const newBookingBusyEnd = new Date(
    endAt.getTime() + bufferMinutes * 60_000,
  );

  const [conflict] = await db
    .select({
      id: bookings.id,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.specialistId, specialistId),

        inArray(bookings.status, ["pending", "confirmed"]),

        sql<boolean>`
          (
            CASE
              WHEN ${bookings.status} = 'confirmed'
              THEN COALESCE(
                ${bookings.confirmedStartAt},
                ${bookings.requestedStartAt}
              )
              ELSE ${bookings.requestedStartAt}
            END
          ) < ${newBookingBusyEnd}
        `,

        sql<boolean>`
          (
            (
              CASE
                WHEN ${bookings.status} = 'confirmed'
                THEN COALESCE(
                  ${bookings.confirmedEndAt},
                  ${bookings.requestedEndAt}
                )
                ELSE ${bookings.requestedEndAt}
              END
            )
            + (
              ${bufferMinutes}
              * INTERVAL '1 minute'
            )
          ) > ${startAt}
        `,
      ),
    )
    .limit(1);

  if (conflict) {
    throw new Error("BOOKING_SLOT_UNAVAILABLE");
  }

  const calendarId = await getSpecialistCalendarId(specialistId);

  const googleBusyPeriods = await getGoogleBusyPeriods({
    calendarId,
    timeMin: startAt,
    timeMax: newBookingBusyEnd,
  });

  const googleConflict = googleBusyPeriods.some(
    (period) => period.start < newBookingBusyEnd && period.end > startAt,
  );

  if (googleConflict) {
    throw new Error("BOOKING_SLOT_UNAVAILABLE");
  }
};
