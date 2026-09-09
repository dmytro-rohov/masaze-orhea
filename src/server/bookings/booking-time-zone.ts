import { weekdayEnum } from "@/db/schema";

export type AvailabilityWeekday = (typeof weekdayEnum.enumValues)[number];

export type BookingZonedDateTime = {
  dateKey: string;
  weekday: AvailabilityWeekday;
  secondsSinceMidnight: number;
};

export const BOOKING_TIME_ZONE = "Europe/Warsaw";
export const MILLISECONDS_PER_MINUTE = 60_000;
export const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;

const bookingDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const databaseTimePattern = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/;

const weekdayByUtcDay = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const satisfies ReadonlyArray<AvailabilityWeekday>;

const warsawDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  calendar: "iso8601",
  timeZone: BOOKING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const getDateTimePart = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number => {
  const value = parts.find((part) => part.type === type)?.value;

  if (!value) {
    throw new Error("BOOKING_TIME_ZONE_CONVERSION_FAILED");
  }

  return Number(value);
};

const getDateParts = (dateKey: string) => {
  const match = bookingDatePattern.exec(dateKey);

  if (!match) {
    throw new Error("BOOKING_INVALID_DATE");
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("BOOKING_INVALID_DATE");
  }

  return { year, month, day };
};

const formatDateKey = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const isValidBookingDate = (dateKey: string): boolean => {
  try {
    getDateParts(dateKey);
    return true;
  } catch {
    return false;
  }
};

export const getBookingZonedDateTime = (date: Date): BookingZonedDateTime => {
  const parts = warsawDateTimeFormatter.formatToParts(date);
  const year = getDateTimePart(parts, "year");
  const month = getDateTimePart(parts, "month");
  const day = getDateTimePart(parts, "day");
  const hour = getDateTimePart(parts, "hour");
  const minute = getDateTimePart(parts, "minute");
  const second = getDateTimePart(parts, "second");
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    dateKey: formatDateKey(year, month, day),
    weekday: weekdayByUtcDay[utcDay],
    secondsSinceMidnight: hour * 3600 + minute * 60 + second,
  };
};

export const parseDatabaseTime = (value: string): number => {
  const match = databaseTimePattern.exec(value);

  if (!match) {
    throw new Error("SPECIALIST_AVAILABILITY_CONFIGURATION_INVALID");
  }

  const [, hourValue, minuteValue, secondValue] = match;
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);

  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error("SPECIALIST_AVAILABILITY_CONFIGURATION_INVALID");
  }

  return hour * 3600 + minute * 60 + second;
};

export const addBookingCalendarDays = (
  dateKey: string,
  days: number,
): string => {
  const { year, month, day } = getDateParts(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return formatDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
};

export const createBookingDateTime = (
  dateKey: string,
  secondsSinceMidnight: number,
): Date => {
  const { year, month, day } = getDateParts(dateKey);
  const hour = Math.floor(secondsSinceMidnight / 3600);
  const minute = Math.floor((secondsSinceMidnight % 3600) / 60);
  const second = secondsSinceMidnight % 60;
  const targetWallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = targetWallClock;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const local = getBookingZonedDateTime(new Date(instant));
    const localDate = getDateParts(local.dateKey);
    const localWallClock =
      Date.UTC(localDate.year, localDate.month - 1, localDate.day) +
      local.secondsSinceMidnight * 1000;
    const adjustment = targetWallClock - localWallClock;

    if (adjustment === 0) {
      return new Date(instant);
    }

    instant += adjustment;
  }

  throw new Error("BOOKING_TIME_ZONE_CONVERSION_FAILED");
};

export const getBookingDayRange = (dateKey: string) => ({
  start: createBookingDateTime(dateKey, 0),
  end: createBookingDateTime(addBookingCalendarDays(dateKey, 1), 0),
});

export const doesBusyIntervalFitWorkingWindow = ({
  startAt,
  effectiveEndAt,
  windowStartTime,
  windowEndTime,
}: {
  startAt: Date;
  effectiveEndAt: Date;
  windowStartTime: string;
  windowEndTime: string;
}): boolean => {
  const localStart = getBookingZonedDateTime(startAt);
  const localEnd = getBookingZonedDateTime(effectiveEndAt);

  return (
    localStart.dateKey === localEnd.dateKey &&
    localStart.secondsSinceMidnight >= parseDatabaseTime(windowStartTime) &&
    localEnd.secondsSinceMidnight <= parseDatabaseTime(windowEndTime)
  );
};
