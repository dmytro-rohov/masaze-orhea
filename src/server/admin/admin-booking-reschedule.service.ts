import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookings } from "@/db/schema";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { getAdminBookingScopeCondition } from "@/server/admin/admin-bookings.service";
import { updateGoogleCalendarEvent } from "@/server/calendar/google-calendar.service";
import { getSpecialistCalendarId } from "@/server/calendar/specialist-calendar.service";
import { assertBookingSlotAvailable } from "@/server/bookings/booking.availability";
import { getBookingBufferMinutes } from "@/server/bookings/booking-settings.service";
import {
  createBookingDateTime,
  MILLISECONDS_PER_MINUTE,
} from "@/server/bookings/booking-time-zone";
import { assertBookingTimeWindow } from "@/server/bookings/booking-time-window.service";
import type { BookingSpecialistId } from "@/server/bookings/booking.types";

const GOOGLE_CALENDAR_TIME_ZONE = "Europe/Warsaw";
const bookingDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const bookingTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

type RescheduleFailureReason =
  | "not_found"
  | "invalid_input"
  | "invalid_status"
  | "unavailable"
  | "configuration_failure"
  | "calendar_failure"
  | "concurrent_change";

export type AdminBookingRescheduleResult =
  | {
      success: true;
      bookingId: string;
      startAt: Date;
      endAt: Date;
    }
  | {
      success: false;
      reason: RescheduleFailureReason;
      errorCode?: string;
      bookingUpdated?: boolean;
    };

const configurationErrorCodes = new Set([
  "BOOKING_SETTINGS_NOT_FOUND",
  "SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND",
  "SPECIALIST_AVAILABILITY_CONFIGURATION_INVALID",
  "SPECIALIST_CALENDAR_NOT_FOUND",
  "GOOGLE_CALENDAR_NOT_FOUND",
  "GOOGLE_CALENDAR_QUERY_FAILED",
  "GOOGLE_CALENDAR_UNAVAILABLE",
]);

const getCalendarUpdateErrorCode = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "ADMIN_BOOKING_CALENDAR_UPDATE_FAILED";
  }

  switch (error.message) {
    case "SPECIALIST_CALENDAR_NOT_FOUND":
    case "GOOGLE_CALENDAR_EVENT_NOT_FOUND":
    case "GOOGLE_CALENDAR_EVENT_UPDATE_FAILED":
      return error.message;
    default:
      return "ADMIN_BOOKING_CALENDAR_UPDATE_FAILED";
  }
};

const parseWarsawStartAt = (date: string, time: string): Date | null => {
  if (!bookingDatePattern.test(date)) return null;

  const timeMatch = bookingTimePattern.exec(time);
  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  try {
    return createBookingDateTime(date, hours * 3600 + minutes * 60);
  } catch {
    return null;
  }
};

export const rescheduleAdminBooking = async (
  session: AdminSession,
  bookingId: string,
  date: string,
  time: string,
): Promise<AdminBookingRescheduleResult> => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bookingId,
    )
  ) {
    return { success: false, reason: "not_found" };
  }

  const requestedStartAt = parseWarsawStartAt(date, time);

  if (!requestedStartAt) {
    return { success: false, reason: "invalid_input" };
  }

  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      specialistId: bookings.specialistId,
      bookingSlotMinutesSnapshot: bookings.bookingSlotMinutesSnapshot,
      googleCalendarEventId: bookings.googleCalendarEventId,
      updatedAt: bookings.updatedAt,
    })
    .from(bookings)
    .where(
      and(eq(bookings.id, bookingId), getAdminBookingScopeCondition(session)),
    )
    .limit(1);

  if (!booking) {
    return { success: false, reason: "not_found" };
  }

  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return { success: false, reason: "invalid_status" };
  }

  const requestedEndAt = new Date(
    requestedStartAt.getTime() +
      booking.bookingSlotMinutesSnapshot * MILLISECONDS_PER_MINUTE,
  );

  try {
    const bufferMinutes = await getBookingBufferMinutes();

    await assertBookingTimeWindow({
      specialistId: booking.specialistId as BookingSpecialistId,
      startAt: requestedStartAt,
      endAt: requestedEndAt,
      bufferMinutes,
    });

    await assertBookingSlotAvailable({
      specialistId: booking.specialistId as BookingSpecialistId,
      startAt: requestedStartAt,
      endAt: requestedEndAt,
      bufferMinutes,
      excludeBookingId: booking.id,
      excludeGoogleCalendarEventId: booking.googleCalendarEventId ?? undefined,
    });
  } catch (error) {
    const errorCode =
      error instanceof Error ? error.message : "BOOKING_AVAILABILITY_FAILED";

    if (errorCode === "BOOKING_SLOT_UNAVAILABLE") {
      return { success: false, reason: "unavailable", errorCode };
    }

    if (
      errorCode === "BOOKING_MIN_NOTICE_NOT_MET" ||
      errorCode === "BOOKING_MAX_ADVANCE_EXCEEDED" ||
      errorCode === "BOOKING_OUTSIDE_WORKING_HOURS"
    ) {
      return { success: false, reason: "invalid_input", errorCode };
    }

    if (configurationErrorCodes.has(errorCode)) {
      return { success: false, reason: "configuration_failure", errorCode };
    }

    throw error;
  }

  const attemptedAt = new Date();
  const [updatedBooking] = await db
    .update(bookings)
    .set({
      requestedStartAt,
      requestedEndAt,
      confirmedStartAt:
        booking.status === "confirmed" ? requestedStartAt : null,
      confirmedEndAt: booking.status === "confirmed" ? requestedEndAt : null,
      calendarSyncStatus: "pending",
      calendarSyncLastError: null,
      calendarSyncAttemptedAt: attemptedAt,
      calendarSyncedAt: null,
      updatedAt: attemptedAt,
    })
    .where(
      and(
        eq(bookings.id, booking.id),
        eq(bookings.updatedAt, booking.updatedAt),
        getAdminBookingScopeCondition(session),
      ),
    )
    .returning({ id: bookings.id });

  if (!updatedBooking) {
    return { success: false, reason: "concurrent_change" };
  }

  let calendarErrorCode: string | null = null;

  if (!booking.googleCalendarEventId) {
    calendarErrorCode = "GOOGLE_CALENDAR_EVENT_ID_MISSING";
  } else {
    try {
      const calendarId = await getSpecialistCalendarId(
        booking.specialistId as BookingSpecialistId,
      );

      await updateGoogleCalendarEvent({
        calendarId,
        eventId: booking.googleCalendarEventId,
        updates: {
          start: {
            dateTime: requestedStartAt.toISOString(),
            timeZone: GOOGLE_CALENDAR_TIME_ZONE,
          },
          end: {
            dateTime: requestedEndAt.toISOString(),
            timeZone: GOOGLE_CALENDAR_TIME_ZONE,
          },
        },
      });
    } catch (error) {
      calendarErrorCode = getCalendarUpdateErrorCode(error);
    }
  }

  if (calendarErrorCode) {
    const failedAt = new Date();

    await db
      .update(bookings)
      .set({
        calendarSyncStatus: "failed",
        calendarSyncLastError: calendarErrorCode,
        calendarSyncAttemptedAt: attemptedAt,
        calendarSyncedAt: null,
        updatedAt: failedAt,
      })
      .where(eq(bookings.id, booking.id));

    return {
      success: false,
      reason: "calendar_failure",
      errorCode: calendarErrorCode,
      bookingUpdated: true,
    };
  }

  const syncedAt = new Date();

  await db
    .update(bookings)
    .set({
      calendarSyncStatus: "synced",
      calendarSyncLastError: null,
      calendarSyncAttemptedAt: attemptedAt,
      calendarSyncedAt: syncedAt,
      updatedAt: syncedAt,
    })
    .where(eq(bookings.id, booking.id));

  return {
    success: true,
    bookingId: booking.id,
    startAt: requestedStartAt,
    endAt: requestedEndAt,
  };
};
