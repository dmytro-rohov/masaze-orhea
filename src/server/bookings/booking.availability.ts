import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookings } from "@/db/schema";
import { bookingBlocksAvailability } from "./booking-blocking.condition";

import {
  getGoogleBusyPeriods,
  type GoogleBusyPeriod,
} from "../calendar/google-calendar.service";
import { getSpecialistAvailabilityCalendarId } from "../calendar/specialist-calendar.service";

import {
  getBookingDayRange,
  getBookingZonedDateTime,
  MILLISECONDS_PER_MINUTE,
} from "./booking-time-zone";
import { getSpecialistAvailabilitySettings } from "./booking-time-window.service";
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
  executor?: Pick<typeof db, "select">;
};

type GetSpecialistGoogleBusyPeriodsInput = {
  specialistId: BookingSpecialistId;
  timeMin: Date;
  timeMax: Date;
};

type GetSpecialistDailyBookingCountInput = {
  specialistId: BookingSpecialistId;
  date: string;
  excludeBookingId?: string;
  executor?: Pick<typeof db, "select">;
};

type AssertBookingSlotAvailableInput = {
  specialistId: BookingSpecialistId;
  startAt: Date;
  endAt: Date;
  bufferMinutes: number;
  excludeBookingId?: string;
};

const effectiveBookingStart = sql<Date>`
  CASE
    WHEN ${bookings.status} = 'confirmed'
    THEN COALESCE(
      ${bookings.confirmedStartAt},
      ${bookings.requestedStartAt}
    )
    ELSE ${bookings.requestedStartAt}
  END
`;

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
  executor = db,
}: GetBookingBusyPeriodsInput): Promise<BookingBusyPeriod[]> => {
  const blockingBookings = await executor
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

        bookingBlocksAvailability,

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

export const getSpecialistDailyBookingCount = async ({
  specialistId,
  date,
  excludeBookingId,
  executor = db,
}: GetSpecialistDailyBookingCountInput): Promise<number> => {
  const dayRange = getBookingDayRange(date);

  const [result] = await executor
    .select({
      count: sql<number>`
              count(*)
            `.mapWith(Number),
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.specialistId, specialistId),

        excludeBookingId ? ne(bookings.id, excludeBookingId) : undefined,

        bookingBlocksAvailability,

        sql<boolean>`
              ${effectiveBookingStart}
              >=
              ${dayRange.start}
            `,

        sql<boolean>`
              ${effectiveBookingStart}
              <
              ${dayRange.end}
            `,
      ),
    );

  return result?.count ?? 0;
};

export const isSpecialistDailyBookingLimitReached = async ({
  specialistId,
  date,
  maxBookingsPerDay,
  excludeBookingId,
}: {
  specialistId: BookingSpecialistId;
  date: string;
  maxBookingsPerDay: number | null;
  excludeBookingId?: string;
}): Promise<boolean> => {
  if (maxBookingsPerDay === null) {
    return false;
  }

  const bookingCount = await getSpecialistDailyBookingCount({
    specialistId,
    date,
    excludeBookingId,
  });

  return bookingCount >= maxBookingsPerDay;
};

export const getSpecialistGoogleBusyPeriods = async ({
  specialistId,
  timeMin,
  timeMax,
}: GetSpecialistGoogleBusyPeriodsInput): Promise<GoogleBusyPeriod[]> => {
  const calendarId = await getSpecialistAvailabilityCalendarId(specialistId);

  return getGoogleBusyPeriods({
    calendarId,
    timeMin,
    timeMax,
  });
};

export const assertBookingSlotAvailable = async ({
  specialistId,
  startAt,
  endAt,
  bufferMinutes,
  excludeBookingId,
}: AssertBookingSlotAvailableInput) => {
  const candidateEffectiveEnd = new Date(
    endAt.getTime() + bufferMinutes * MILLISECONDS_PER_MINUTE,
  );

  const date = getBookingZonedDateTime(startAt).dateKey;

  const availabilitySettings =
    await getSpecialistAvailabilitySettings(specialistId);

  const dailyLimitReached = await isSpecialistDailyBookingLimitReached({
    specialistId,

    date,

    maxBookingsPerDay: availabilitySettings.maxBookingsPerDay,

    excludeBookingId,
  });

  if (dailyLimitReached) {
    throw new Error("BOOKING_SLOT_UNAVAILABLE");
  }

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

  });

  if (
    googleBusyPeriods.some((period) =>
      busyPeriodsOverlap(period, startAt, candidateEffectiveEnd),
    )
  ) {
    throw new Error("BOOKING_SLOT_UNAVAILABLE");
  }
};
