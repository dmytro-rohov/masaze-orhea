import { eq } from "drizzle-orm";

import { db } from "@/db";
import { bookingSettings, GLOBAL_BOOKING_SETTINGS_ID } from "@/db/schema";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";

export type AdminBookingSettings = {
  bufferMinutes: number;
  slotStepMinutes: number;
};

type UpdateAdminBookingSettingsInput = {
  session: AdminSession;
  bufferMinutes: number;
  slotStepMinutes: number;
};

export const getAdminBookingSettings = async (
  session: AdminSession,
): Promise<AdminBookingSettings> => {
  if (!isOwner(session)) {
    throw new Error("ADMIN_OWNER_ACCESS_REQUIRED");
  }

  const [settings] = await db
    .select({
      bufferMinutes: bookingSettings.bufferMinutes,

      slotStepMinutes: bookingSettings.slotStepMinutes,
    })
    .from(bookingSettings)
    .where(eq(bookingSettings.id, GLOBAL_BOOKING_SETTINGS_ID))
    .limit(1);

  if (!settings) {
    throw new Error("BOOKING_SETTINGS_NOT_FOUND");
  }

  return settings;
};

export const updateAdminBookingSettings = async ({
  session,
  bufferMinutes,
  slotStepMinutes,
}: UpdateAdminBookingSettingsInput): Promise<AdminBookingSettings> => {
  if (!isOwner(session)) {
    throw new Error("ADMIN_OWNER_ACCESS_REQUIRED");
  }

  if (
    !Number.isInteger(bufferMinutes) ||
    bufferMinutes < 0 ||
    bufferMinutes > 240
  ) {
    throw new Error("ADMIN_BOOKING_BUFFER_INVALID");
  }

  if (
    !Number.isInteger(slotStepMinutes) ||
    slotStepMinutes < 5 ||
    slotStepMinutes > 120
  ) {
    throw new Error("ADMIN_BOOKING_SLOT_STEP_INVALID");
  }

  const [updated] = await db
    .update(bookingSettings)
    .set({
      bufferMinutes,

      slotStepMinutes,

      updatedAt: new Date(),
    })
    .where(eq(bookingSettings.id, GLOBAL_BOOKING_SETTINGS_ID))
    .returning({
      bufferMinutes: bookingSettings.bufferMinutes,

      slotStepMinutes: bookingSettings.slotStepMinutes,
    });

  if (!updated) {
    throw new Error("BOOKING_SETTINGS_NOT_FOUND");
  }

  return updated;
};
