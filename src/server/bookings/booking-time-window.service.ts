import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  specialistAvailabilityOverrides,
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

type GetSpecialistAvailabilityForDateInput = {
  specialistId: BookingSpecialistId;
  date: string;
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
  "BOOKING_MIN_NOTICE_NOT_MET" | "BOOKING_MAX_ADVANCE_EXCEEDED";

export type SpecialistWorkingWindow = {
  startTime: string;
  endTime: string;
};

export type SpecialistAvailabilityForDate = {
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  maxBookingsPerDay: number | null;
  workingWindows: SpecialistWorkingWindow[];
  source: "weekly" | "override";
};

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

  return {
    minNoticeMinutes,
    maxAdvanceDays,
  };
};

/**
 * Existing weekday-based resolver.
 *
 * Keep this function because it may still be useful in admin/read-only
 * views and avoids breaking existing imports.
 *
 * It does NOT apply date-specific overrides.
 */
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

/**
 * Effective availability resolver for a concrete calendar date.
 *
 * Priority:
 *
 * 1. date-specific override
 * 2. weekly availability rule
 *
 * Override semantics:
 *
 * isAvailable = false
 * -> full day unavailable
 *
 * isAvailable = true
 * -> use only override start/end time
 *
 * No override
 * -> use normal weekly availability
 */
export const getSpecialistAvailabilityForDate = async ({
  specialistId,
  date,
}: GetSpecialistAvailabilityForDateInput): Promise<SpecialistAvailabilityForDate> => {
  const settingsPromise = getSpecialistAvailabilitySettings(specialistId);

  const [override] = await db
    .select({
      isAvailable: specialistAvailabilityOverrides.isAvailable,
      startTime: specialistAvailabilityOverrides.startTime,
      endTime: specialistAvailabilityOverrides.endTime,
    })
    .from(specialistAvailabilityOverrides)
    .where(
      and(
        eq(specialistAvailabilityOverrides.specialistId, specialistId),
        eq(specialistAvailabilityOverrides.date, date),
      ),
    )
    .limit(1);

  const settings = await settingsPromise;

  if (override) {
    if (!override.isAvailable) {
      return {
        ...settings,
        workingWindows: [],
        source: "override",
      };
    }

    if (!override.startTime || !override.endTime) {
      throw new Error("SPECIALIST_AVAILABILITY_OVERRIDE_INVALID");
    }

    return {
      ...settings,
      workingWindows: [
        {
          startTime: override.startTime,
          endTime: override.endTime,
        },
      ],
      source: "override",
    };
  }

  const dateAsInstant = new Date(`${date}T12:00:00Z`);

  if (Number.isNaN(dateAsInstant.getTime())) {
    throw new Error("BOOKING_INVALID_DATE");
  }

  const weekday = getBookingZonedDateTime(dateAsInstant).weekday;

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
    source: "weekly",
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

  const availability = await getSpecialistAvailabilityForDate({
    specialistId,
    date: localStart.dateKey,
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

  if (availability.workingWindows.length === 0) {
    throw new Error("BOOKING_OUTSIDE_WORKING_HOURS");
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
