import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookings } from "@/db/schema";

import { BOOKING_BUFFER_MINUTES } from "./booking.config";
import type { BookingSpecialistId } from "./booking.types";

type AssertBookingSlotAvailableInput = {
  specialistId: BookingSpecialistId;
  startAt: Date;
  endAt: Date;
};

export const assertBookingSlotAvailable = async ({
  specialistId,
  startAt,
  endAt,
}: AssertBookingSlotAvailableInput) => {
  const newBookingBusyEnd = new Date(
    endAt.getTime() + BOOKING_BUFFER_MINUTES * 60_000,
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
              ${BOOKING_BUFFER_MINUTES}
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
};
