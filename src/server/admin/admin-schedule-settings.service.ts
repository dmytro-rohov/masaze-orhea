import { eq } from "drizzle-orm";

import { db } from "@/db";
import { specialistAvailabilitySettings, specialists } from "@/db/schema";

import type { AdminSession } from "./admin-auth.service";
import { isOwner } from "./admin-authorization.service";

import type { BookingSpecialistId } from "../bookings/booking.types";

type UpdateAdminScheduleSettingsInput = {
  session: AdminSession;
  specialistId: BookingSpecialistId;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  maxBookingsPerDay: number | null;
};

const MAX_MIN_NOTICE_MINUTES = 30 * 24 * 60;
const MAX_ADVANCE_DAYS = 365;
const MAX_BOOKINGS_PER_DAY = 100;

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

  if (session.specialistId !== requestedSpecialistId) {
    throw new Error("ADMIN_SPECIALIST_SCOPE_FORBIDDEN");
  }

  return session.specialistId;
};

const assertIntegerInRange = (
  value: number,
  min: number,
  max: number,
  errorCode: string,
) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(errorCode);
  }
};

export const updateAdminScheduleSettings = async ({
  session,
  specialistId,
  minNoticeMinutes,
  maxAdvanceDays,
  maxBookingsPerDay,
}: UpdateAdminScheduleSettingsInput) => {
  const effectiveSpecialistId = resolveSpecialistId(session, specialistId);

  assertIntegerInRange(
    minNoticeMinutes,
    0,
    MAX_MIN_NOTICE_MINUTES,
    "ADMIN_SCHEDULE_MIN_NOTICE_INVALID",
  );

  assertIntegerInRange(
    maxAdvanceDays,
    1,
    MAX_ADVANCE_DAYS,
    "ADMIN_SCHEDULE_MAX_ADVANCE_INVALID",
  );

  if (maxBookingsPerDay !== null) {
    assertIntegerInRange(
      maxBookingsPerDay,
      1,
      MAX_BOOKINGS_PER_DAY,
      "ADMIN_SCHEDULE_MAX_BOOKINGS_INVALID",
    );
  }

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

  const [existingSettings] = await db
    .select({
      id: specialistAvailabilitySettings.id,
    })
    .from(specialistAvailabilitySettings)
    .where(
      eq(specialistAvailabilitySettings.specialistId, effectiveSpecialistId),
    )
    .limit(1);

  if (!existingSettings) {
    throw new Error("SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND");
  }

  const [updated] = await db
    .update(specialistAvailabilitySettings)
    .set({
      minNoticeMinutes,
      maxAdvanceDays,
      maxBookingsPerDay,
      updatedAt: new Date(),
    })
    .where(eq(specialistAvailabilitySettings.id, existingSettings.id))
    .returning({
      specialistId: specialistAvailabilitySettings.specialistId,

      minNoticeMinutes: specialistAvailabilitySettings.minNoticeMinutes,

      maxAdvanceDays: specialistAvailabilitySettings.maxAdvanceDays,

      maxBookingsPerDay: specialistAvailabilitySettings.maxBookingsPerDay,
    });

  if (!updated) {
    throw new Error("SPECIALIST_AVAILABILITY_SETTINGS_UPDATE_FAILED");
  }

  return updated;
};
