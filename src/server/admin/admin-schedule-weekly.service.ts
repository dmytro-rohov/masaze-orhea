import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { specialistAvailabilityRules, specialists } from "@/db/schema";

import type { AdminSession } from "./admin-auth.service";
import { isOwner } from "./admin-authorization.service";

import type { AvailabilityWeekday } from "../bookings/booking-time-zone";
import type { BookingSpecialistId } from "../bookings/booking.types";

const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const satisfies ReadonlyArray<AvailabilityWeekday>;

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MAX_RULES = 50;

export type AdminWeeklyScheduleRuleInput = {
  weekday: AvailabilityWeekday;
  startTime: string;
  endTime: string;
};

type UpdateAdminWeeklyScheduleInput = {
  session: AdminSession;
  specialistId: BookingSpecialistId;
  rules: AdminWeeklyScheduleRuleInput[];
};

const isBookingSpecialistId = (value: unknown): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

const isAvailabilityWeekday = (value: unknown): value is AvailabilityWeekday =>
  typeof value === "string" && weekdays.includes(value as AvailabilityWeekday);

const normalizeTime = (value: string): string => `${value}:00`;

const validateTime = (value: unknown): value is string =>
  typeof value === "string" && timePattern.test(value);

const resolveSpecialistId = (
  session: AdminSession,
  requestedSpecialistId: BookingSpecialistId,
): BookingSpecialistId => {
  if (isOwner(session)) {
    return requestedSpecialistId;
  }

  if (!session.specialistId) {
    throw new Error("ADMIN_SPECIALIST_SCOPE_INVALID");
  }

  if (requestedSpecialistId !== session.specialistId) {
    throw new Error("ADMIN_SPECIALIST_SCOPE_FORBIDDEN");
  }

  return session.specialistId;
};

const validateRules = (
  rules: AdminWeeklyScheduleRuleInput[],
): AdminWeeklyScheduleRuleInput[] => {
  if (!Array.isArray(rules) || rules.length > MAX_RULES) {
    throw new Error("ADMIN_WEEKLY_SCHEDULE_INVALID");
  }

  const normalized = rules.map((rule) => {
    if (
      !rule ||
      !isAvailabilityWeekday(rule.weekday) ||
      !validateTime(rule.startTime) ||
      !validateTime(rule.endTime)
    ) {
      throw new Error("ADMIN_WEEKLY_SCHEDULE_INVALID");
    }

    if (rule.startTime >= rule.endTime) {
      throw new Error("ADMIN_WEEKLY_SCHEDULE_INVALID_TIME_RANGE");
    }

    return {
      weekday: rule.weekday,
      startTime: rule.startTime,
      endTime: rule.endTime,
    };
  });

  for (const weekday of weekdays) {
    const weekdayRules = normalized
      .filter((rule) => rule.weekday === weekday)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (let index = 1; index < weekdayRules.length; index += 1) {
      const previous = weekdayRules[index - 1];

      const current = weekdayRules[index];

      if (current.startTime < previous.endTime) {
        throw new Error("ADMIN_WEEKLY_SCHEDULE_OVERLAP");
      }
    }
  }

  return normalized.sort((a, b) => {
    const weekdayDifference =
      weekdays.indexOf(a.weekday) - weekdays.indexOf(b.weekday);

    if (weekdayDifference !== 0) {
      return weekdayDifference;
    }

    return a.startTime.localeCompare(b.startTime);
  });
};

export const parseAdminWeeklyScheduleRules = (
  value: unknown,
): AdminWeeklyScheduleRuleInput[] => {
  if (typeof value !== "string") {
    throw new Error("ADMIN_WEEKLY_SCHEDULE_INVALID");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("ADMIN_WEEKLY_SCHEDULE_INVALID");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("ADMIN_WEEKLY_SCHEDULE_INVALID");
  }

  return parsed.map((rule) => {
    if (typeof rule !== "object" || rule === null) {
      throw new Error("ADMIN_WEEKLY_SCHEDULE_INVALID");
    }

    const candidate = rule as Record<string, unknown>;

    if (
      !isAvailabilityWeekday(candidate.weekday) ||
      !validateTime(candidate.startTime) ||
      !validateTime(candidate.endTime)
    ) {
      throw new Error("ADMIN_WEEKLY_SCHEDULE_INVALID");
    }

    return {
      weekday: candidate.weekday,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
    };
  });
};

export const updateAdminWeeklySchedule = async ({
  session,
  specialistId,
  rules,
}: UpdateAdminWeeklyScheduleInput) => {
  if (!isBookingSpecialistId(specialistId)) {
    throw new Error("ADMIN_SPECIALIST_INVALID");
  }

  const effectiveSpecialistId = resolveSpecialistId(session, specialistId);

  const validatedRules = validateRules(rules);

  const [specialist] = await db
    .select({
      id: specialists.id,
    })
    .from(specialists)
    .where(eq(specialists.id, effectiveSpecialistId))
    .limit(1);

  if (!specialist) {
    throw new Error("SPECIALIST_NOT_FOUND");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(specialistAvailabilityRules)
      .where(
        eq(specialistAvailabilityRules.specialistId, effectiveSpecialistId),
      );

    if (validatedRules.length > 0) {
      await tx.insert(specialistAvailabilityRules).values(
        validatedRules.map((rule) => ({
          specialistId: effectiveSpecialistId,

          weekday: rule.weekday,

          startTime: normalizeTime(rule.startTime),

          endTime: normalizeTime(rule.endTime),

          isActive: true,
        })),
      );
    }
  });

  const savedRules = await db
    .select({
      id: specialistAvailabilityRules.id,

      weekday: specialistAvailabilityRules.weekday,

      startTime: specialistAvailabilityRules.startTime,

      endTime: specialistAvailabilityRules.endTime,
    })
    .from(specialistAvailabilityRules)
    .where(eq(specialistAvailabilityRules.specialistId, effectiveSpecialistId))
    .orderBy(
      asc(specialistAvailabilityRules.weekday),
      asc(specialistAvailabilityRules.startTime),
    );

  return {
    specialistId: effectiveSpecialistId,
    rules: savedRules,
  };
};
