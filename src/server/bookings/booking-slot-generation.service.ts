import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { massages, massageVariants, specialists } from "@/db/schema";

import {
  busyPeriodsOverlap,
  getBookingBusyPeriods,
  getSpecialistGoogleBusyPeriods,
} from "./booking.availability";
import { getBookingSchedulingSettings } from "./booking-settings.service";
import {
  BOOKING_TIME_ZONE,
  createBookingDateTime,
  doesBusyIntervalFitWorkingWindow,
  getBookingDayRange,
  getBookingZonedDateTime,
  MILLISECONDS_PER_MINUTE,
  parseDatabaseTime,
} from "./booking-time-zone";
import {
  getBookingTimeHorizonError,
  getSpecialistAvailabilityForWeekday,
} from "./booking-time-window.service";
import type { BookingSpecialistId } from "./booking.types";

type GenerateBookingSlotsInput = {
  specialistId: BookingSpecialistId;
  massageId: string;
  variantCode: string;
  date: string;
  now?: Date;
};

export type BookingAvailabilitySlot = {
  startAt: string;
  endAt: string;
};

export type BookingAvailabilityResult = {
  date: string;
  specialistId: BookingSpecialistId;
  massageId: string;
  variantCode: string;
  timezone: typeof BOOKING_TIME_ZONE;
  slots: BookingAvailabilitySlot[];
};

type CandidateSlot = {
  startAt: Date;
  endAt: Date;
  effectiveEndAt: Date;
};

const createEmptyResult = ({
  date,
  specialistId,
  massageId,
  variantCode,
}: Omit<GenerateBookingSlotsInput, "now">): BookingAvailabilityResult => ({
  date,
  specialistId,
  massageId,
  variantCode,
  timezone: BOOKING_TIME_ZONE,
  slots: [],
});

export const generateBookingAvailability = async ({
  specialistId,
  massageId,
  variantCode,
  date,
  now = new Date(),
}: GenerateBookingSlotsInput): Promise<BookingAvailabilityResult> => {
  const [specialist] = await db
    .select({
      isActive: specialists.isActive,
    })
    .from(specialists)
    .where(eq(specialists.id, specialistId))
    .limit(1);

  if (!specialist || !specialist.isActive) {
    throw new Error("BOOKING_SPECIALIST_UNAVAILABLE");
  }

  const [selectedVariant] = await db
    .select({
      massageIsActive: massages.isActive,
      bookingAvailable: massages.bookingAvailable,
      variantIsActive: massageVariants.isActive,
      bookingSlotMinutes: massageVariants.bookingSlotMinutes,
    })
    .from(massageVariants)
    .innerJoin(massages, eq(massageVariants.massageId, massages.id))
    .where(
      and(
        eq(massages.id, massageId),
        eq(massageVariants.code, variantCode),
      ),
    )
    .limit(1);

  if (!selectedVariant) {
    throw new Error("BOOKING_VARIANT_NOT_FOUND");
  }

  if (
    !selectedVariant.massageIsActive ||
    !selectedVariant.bookingAvailable ||
    !selectedVariant.variantIsActive
  ) {
    throw new Error("BOOKING_VARIANT_UNAVAILABLE");
  }

  const dayRange = getBookingDayRange(date);
  const weekday = getBookingZonedDateTime(dayRange.start).weekday;
  const [availability, schedulingSettings] = await Promise.all([
    getSpecialistAvailabilityForWeekday({ specialistId, weekday }),
    getBookingSchedulingSettings(),
  ]);
  const emptyResult = createEmptyResult({
    date,
    specialistId,
    massageId,
    variantCode,
  });

  if (availability.workingWindows.length === 0) {
    return emptyResult;
  }

  const candidates = new Map<number, CandidateSlot>();
  const slotStepSeconds = schedulingSettings.slotStepMinutes * 60;

  for (const window of availability.workingWindows) {
    const windowStart = parseDatabaseTime(window.startTime);
    const windowEnd = parseDatabaseTime(window.endTime);

    for (
      let candidateWallTime = windowStart;
      candidateWallTime < windowEnd;
      candidateWallTime += slotStepSeconds
    ) {
      let startAt: Date;

      try {
        startAt = createBookingDateTime(date, candidateWallTime);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "BOOKING_TIME_ZONE_CONVERSION_FAILED"
        ) {
          continue;
        }

        throw error;
      }

      if (
        getBookingTimeHorizonError({
          startAt,
          minNoticeMinutes: availability.minNoticeMinutes,
          maxAdvanceDays: availability.maxAdvanceDays,
          now,
        })
      ) {
        continue;
      }

      const endAt = new Date(
        startAt.getTime() +
          selectedVariant.bookingSlotMinutes * MILLISECONDS_PER_MINUTE,
      );
      const effectiveEndAt = new Date(
        endAt.getTime() +
          schedulingSettings.bufferMinutes * MILLISECONDS_PER_MINUTE,
      );

      if (
        !doesBusyIntervalFitWorkingWindow({
          startAt,
          effectiveEndAt,
          windowStartTime: window.startTime,
          windowEndTime: window.endTime,
        })
      ) {
        continue;
      }

      candidates.set(startAt.getTime(), {
        startAt,
        endAt,
        effectiveEndAt,
      });
    }
  }

  if (candidates.size === 0) {
    return emptyResult;
  }

  const [bookingBusyPeriods, googleBusyPeriods] = await Promise.all([
    getBookingBusyPeriods({
      specialistId,
      timeMin: dayRange.start,
      timeMax: dayRange.end,
      bufferMinutes: schedulingSettings.bufferMinutes,
    }),
    getSpecialistGoogleBusyPeriods({
      specialistId,
      timeMin: dayRange.start,
      timeMax: dayRange.end,
    }),
  ]);

  const slots = [...candidates.values()]
    .filter(
      (candidate) =>
        !bookingBusyPeriods.some((period) =>
          busyPeriodsOverlap(
            period,
            candidate.startAt,
            candidate.effectiveEndAt,
          ),
        ) &&
        !googleBusyPeriods.some((period) =>
          busyPeriodsOverlap(
            period,
            candidate.startAt,
            candidate.effectiveEndAt,
          ),
        ),
    )
    .sort((first, second) => first.startAt.getTime() - second.startAt.getTime())
    .map((candidate) => ({
      startAt: candidate.startAt.toISOString(),
      endAt: candidate.endAt.toISOString(),
    }));

  return {
    ...emptyResult,
    slots,
  };
};
