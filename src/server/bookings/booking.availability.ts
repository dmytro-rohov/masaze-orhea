import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookings } from "@/db/schema";

import {
  getGoogleBusyPeriods,
  type GoogleBusyPeriod,
} from "../calendar/google-calendar.service";
import { getSpecialistCalendarId } from "../calendar/specialist-calendar.service";

import { MILLISECONDS_PER_MINUTE } from "./booking-time-zone";
import type { BookingSpecialistId } from "./booking.types";

export type BookingBusyPeriod = {
  start: Date;
  end: Date;
};

type GetBookingBusyPeriodsInput = {
  specialistId: BookingSpecialistId;
  timeMin: Date;
  timeMax: Date;
  bufferMinutes: number;
  excludeBookingId?: string;
};

type GetSpecialistGoogleBusyPeriodsInput = {
  specialistId: BookingSpecialistId;
  timeMin: Date;
  timeMax: Date;
  excludeEventId?: string;
};

type AssertBookingSlotAvailableInput = {
  specialistId: BookingSpecialistId;
  startAt: Date;
  endAt: Date;
  bufferMinutes: number;
  excludeBookingId?: string;
  excludeGoogleCalendarEventId?: string;
};

export const busyPeriodsOverlap = (
  busyPeriod: BookingBusyPeriod | GoogleBusyPeriod,
  candidateStart: Date,
  candidateEffectiveEnd: Date,
): boolean =>
  busyPeriod.start < candidateEffectiveEnd && busyPeriod.end > candidateStart;

export const getBookingBusyPeriods = async ({
  specialistId,
  timeMin,
  timeMax,
  bufferMinutes,
  excludeBookingId,
}: GetBookingBusyPeriodsInput): Promise<BookingBusyPeriod[]> => {
  const blockingBookings = await db
    .select({
      status: bookings.status,
      requestedStartAt: bookings.requestedStartAt,
      requestedEndAt: bookings.requestedEndAt,
      confirmedStartAt: bookings.confirmedStartAt,
      confirmedEndAt: bookings.confirmedEndAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.specialistId, specialistId),
        excludeBookingId ? ne(bookings.id, excludeBookingId) : undefined,
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
          ) < ${timeMax}
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
          ) > ${timeMin}
        `,
      ),
    );

  return blockingBookings.map((booking) => {
    const usesConfirmedTime = booking.status === "confirmed";
    const start = usesConfirmedTime
      ? (booking.confirmedStartAt ?? booking.requestedStartAt)
      : booking.requestedStartAt;
    const end = usesConfirmedTime
      ? (booking.confirmedEndAt ?? booking.requestedEndAt)
      : booking.requestedEndAt;

    return {
      start,
      end: new Date(end.getTime() + bufferMinutes * MILLISECONDS_PER_MINUTE),
    };
  });
};

export const getSpecialistGoogleBusyPeriods = async ({
  specialistId,
  timeMin,
  timeMax,
  excludeEventId,
}: GetSpecialistGoogleBusyPeriodsInput): Promise<GoogleBusyPeriod[]> => {
  const calendarId = await getSpecialistCalendarId(specialistId);

  return getGoogleBusyPeriods({
    calendarId,
    timeMin,
    timeMax,
    excludeEventId,
  });
};

export const assertBookingSlotAvailable = async ({
  specialistId,
  startAt,
  endAt,
  bufferMinutes,
  excludeBookingId,
  excludeGoogleCalendarEventId,
}: AssertBookingSlotAvailableInput) => {
  const candidateEffectiveEnd = new Date(
    endAt.getTime() + bufferMinutes * MILLISECONDS_PER_MINUTE,
  );
  const bookingBusyPeriods = await getBookingBusyPeriods({
    specialistId,
    timeMin: startAt,
    timeMax: candidateEffectiveEnd,
    bufferMinutes,
    excludeBookingId,
  });

  if (
    bookingBusyPeriods.some((period) =>
      busyPeriodsOverlap(period, startAt, candidateEffectiveEnd),
    )
  ) {
    throw new Error("BOOKING_SLOT_UNAVAILABLE");
  }

  const googleBusyPeriods = await getSpecialistGoogleBusyPeriods({
    specialistId,
    timeMin: startAt,
    timeMax: candidateEffectiveEnd,
    excludeEventId: excludeGoogleCalendarEventId,
  });

  if (
    googleBusyPeriods.some((period) =>
      busyPeriodsOverlap(period, startAt, candidateEffectiveEnd),
    )
  ) {
    throw new Error("BOOKING_SLOT_UNAVAILABLE");
  }
};
