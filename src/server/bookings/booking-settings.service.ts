import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  bookingSettings,
  GLOBAL_BOOKING_SETTINGS_ID,
} from "@/db/schema";

export const getBookingSchedulingSettings = async () => {
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

export const getBookingBufferMinutes = async (): Promise<number> =>
  (await getBookingSchedulingSettings()).bufferMinutes;
