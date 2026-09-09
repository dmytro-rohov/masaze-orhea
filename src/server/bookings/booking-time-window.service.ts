import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  specialistAvailabilityRules,
  specialistAvailabilitySettings,
  weekdayEnum,
} from "@/db/schema";

import type { BookingSpecialistId } from "./booking.types";

type AvailabilityWeekday = (typeof weekdayEnum.enumValues)[number];

type GetSpecialistAvailabilityInput = {
  specialistId: BookingSpecialistId;
  weekday: AvailabilityWeekday;
};

type AssertBookingTimeWindowInput = {
  specialistId: BookingSpecialistId;
  startAt: Date;
  endAt: Date;
  bufferMinutes: number;
  now?: Date;
};

type ZonedDateTime = {
  dateKey: string;
  weekday: AvailabilityWeekday;
  secondsSinceMidnight: number;
};

const BOOKING_TIME_ZONE = "Europe/Warsaw";
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;

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

const getWarsawDateTime = (date: Date): ZonedDateTime => {
  const parts = warsawDateTimeFormatter.formatToParts(date);
  const year = getDateTimePart(parts, "year");
  const month = getDateTimePart(parts, "month");
  const day = getDateTimePart(parts, "day");
  const hour = getDateTimePart(parts, "hour");
  const minute = getDateTimePart(parts, "minute");
  const second = getDateTimePart(parts, "second");
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    weekday: weekdayByUtcDay[utcDay],
    secondsSinceMidnight: hour * 3600 + minute * 60 + second,
  };
};

const parseDatabaseTime = (value: string): number => {
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(value);

  if (!match) {
    throw new Error("SPECIALIST_AVAILABILITY_CONFIGURATION_INVALID");
  }

  const [, hour, minute, second] = match;

  return Number(hour) * 3600 + Number(minute) * 60 + Number(second);
};

export const getSpecialistAvailabilityForWeekday = async ({
  specialistId,
  weekday,
}: GetSpecialistAvailabilityInput) => {
  const [settings] = await db
    .select({
      minNoticeMinutes: specialistAvailabilitySettings.minNoticeMinutes,
      maxAdvanceDays: specialistAvailabilitySettings.maxAdvanceDays,
      maxBookingsPerDay: specialistAvailabilitySettings.maxBookingsPerDay,
    })
    .from(specialistAvailabilitySettings)
    .where(eq(specialistAvailabilitySettings.specialistId, specialistId))
    .limit(1);

  if (!settings) {
    throw new Error("SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND");
  }

  const workingWindows = await db
    .select({
      startTime: specialistAvailabilityRules.startTime,
      endTime: specialistAvailabilityRules.endTime,
    })
    .from(specialistAvailabilityRules)
    .where(
      and(
        eq(specialistAvailabilityRules.specialistId, specialistId),
        eq(specialistAvailabilityRules.weekday, weekday),
        eq(specialistAvailabilityRules.isActive, true),
      ),
    );

  return {
    ...settings,
    workingWindows,
  };
};

export const assertBookingTimeWindow = async ({
  specialistId,
  startAt,
  endAt,
  bufferMinutes,
  now = new Date(),
}: AssertBookingTimeWindowInput): Promise<void> => {
  const localStart = getWarsawDateTime(startAt);
  const availability = await getSpecialistAvailabilityForWeekday({
    specialistId,
    weekday: localStart.weekday,
  });

  const minimumStartAt = new Date(
    now.getTime() + availability.minNoticeMinutes * MILLISECONDS_PER_MINUTE,
  );

  if (startAt < minimumStartAt) {
    throw new Error("BOOKING_MIN_NOTICE_NOT_MET");
  }

  const maximumStartAt = new Date(
    now.getTime() + availability.maxAdvanceDays * MILLISECONDS_PER_DAY,
  );

  if (startAt > maximumStartAt) {
    throw new Error("BOOKING_MAX_ADVANCE_EXCEEDED");
  }

  const effectiveBusyEndAt = new Date(
    endAt.getTime() + bufferMinutes * MILLISECONDS_PER_MINUTE,
  );
  const localBusyEnd = getWarsawDateTime(effectiveBusyEndAt);

  const fitsWorkingWindow = availability.workingWindows.some((window) => {
    const windowStart = parseDatabaseTime(window.startTime);
    const windowEnd = parseDatabaseTime(window.endTime);

    return (
      localStart.dateKey === localBusyEnd.dateKey &&
      localStart.secondsSinceMidnight >= windowStart &&
      localBusyEnd.secondsSinceMidnight <= windowEnd
    );
  });

  if (!fitsWorkingWindow) {
    throw new Error("BOOKING_OUTSIDE_WORKING_HOURS");
  }
};
