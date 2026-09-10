import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  specialistAvailabilityRules,
  specialistAvailabilitySettings,
} from "@/db/schema";

import {
  doesBusyIntervalFitWorkingWindow,
  getBookingZonedDateTime,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_MINUTE,
} from "./booking-time-zone";
import type { AvailabilityWeekday } from "./booking-time-zone";
import type { BookingSpecialistId } from "./booking.types";

type GetSpecialistAvailabilityInput = {
  specialistId: BookingSpecialistId;
  weekday: AvailabilityWeekday;
};

type BookingTimeHorizonInput = {
  startAt: Date;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  now?: Date;
};

type AssertBookingTimeWindowInput = {
  specialistId: BookingSpecialistId;
  startAt: Date;
  endAt: Date;
  bufferMinutes: number;
  now?: Date;
};

export type BookingTimeHorizonError =
  | "BOOKING_MIN_NOTICE_NOT_MET"
  | "BOOKING_MAX_ADVANCE_EXCEEDED";

export const getSpecialistAvailabilitySettings = async (
  specialistId: BookingSpecialistId,
) => {
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

  return settings;
};

export const getSpecialistBookingWindow = async (
  specialistId: BookingSpecialistId,
) => {
  const { minNoticeMinutes, maxAdvanceDays } =
    await getSpecialistAvailabilitySettings(specialistId);

  return { minNoticeMinutes, maxAdvanceDays };
};

export const getSpecialistAvailabilityForWeekday = async ({
  specialistId,
  weekday,
}: GetSpecialistAvailabilityInput) => {
  const [settings, workingWindows] = await Promise.all([
    getSpecialistAvailabilitySettings(specialistId),
    db
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
      ),
  ]);

  return {
    ...settings,
    workingWindows,
  };
};

export const getBookingTimeHorizonError = ({
  startAt,
  minNoticeMinutes,
  maxAdvanceDays,
  now = new Date(),
}: BookingTimeHorizonInput): BookingTimeHorizonError | null => {
  const minimumStartAt = new Date(
    now.getTime() + minNoticeMinutes * MILLISECONDS_PER_MINUTE,
  );

  if (startAt < minimumStartAt) {
    return "BOOKING_MIN_NOTICE_NOT_MET";
  }

  const maximumStartAt = new Date(
    now.getTime() + maxAdvanceDays * MILLISECONDS_PER_DAY,
  );

  if (startAt > maximumStartAt) {
    return "BOOKING_MAX_ADVANCE_EXCEEDED";
  }

  return null;
};

export const assertBookingTimeWindow = async ({
  specialistId,
  startAt,
  endAt,
  bufferMinutes,
  now = new Date(),
}: AssertBookingTimeWindowInput): Promise<void> => {
  const localStart = getBookingZonedDateTime(startAt);
  const availability = await getSpecialistAvailabilityForWeekday({
    specialistId,
    weekday: localStart.weekday,
  });
  const horizonError = getBookingTimeHorizonError({
    startAt,
    minNoticeMinutes: availability.minNoticeMinutes,
    maxAdvanceDays: availability.maxAdvanceDays,
    now,
  });

  if (horizonError) {
    throw new Error(horizonError);
  }

  const effectiveBusyEndAt = new Date(
    endAt.getTime() + bufferMinutes * MILLISECONDS_PER_MINUTE,
  );
  const fitsWorkingWindow = availability.workingWindows.some((window) =>
    doesBusyIntervalFitWorkingWindow({
      startAt,
      effectiveEndAt: effectiveBusyEndAt,
      windowStartTime: window.startTime,
      windowEndTime: window.endTime,
    }),
  );

  if (!fitsWorkingWindow) {
    throw new Error("BOOKING_OUTSIDE_WORKING_HOURS");
  }
};
