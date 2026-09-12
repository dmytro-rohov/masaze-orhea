import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookings } from "@/db/schema";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { getAdminBookingScopeCondition } from "@/server/admin/admin-bookings.service";
import { upsertBookingGoogleCalendarEvent } from "@/server/bookings/booking-calendar-sync.service";
import type { BookingSpecialistId } from "@/server/bookings/booking.types";

type RetryFailureReason = "not_found" | "invalid_state" | "calendar_failure";

export type AdminBookingCalendarRetryResult =
  | {
      success: true;
      bookingId: string;
      googleCalendarEventId: string;
    }
  | {
      success: false;
      reason: RetryFailureReason;
      errorCode?: string;
    };

const getCalendarRetryErrorCode = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "ADMIN_BOOKING_CALENDAR_RETRY_FAILED";
  }

  switch (error.message) {
    case "SPECIALIST_CALENDAR_NOT_FOUND":
    case "GOOGLE_CALENDAR_EVENT_GET_FAILED":
    case "GOOGLE_CALENDAR_EVENT_CREATE_FAILED":
    case "GOOGLE_CALENDAR_EVENT_UPDATE_FAILED":
    case "GOOGLE_CALENDAR_EVENT_ID_MISSING":
      return error.message;
    default:
      return "ADMIN_BOOKING_CALENDAR_RETRY_FAILED";
  }
};

export const retryAdminBookingCalendarSync = async (
  session: AdminSession,
  bookingId: string,
): Promise<AdminBookingCalendarRetryResult> => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bookingId,
    )
  ) {
    return { success: false, reason: "not_found" };
  }

  return db.transaction(async (transaction) => {
    const [booking] = await transaction
      .select({
        id: bookings.id,
        specialistId: bookings.specialistId,
        calendarSyncStatus: bookings.calendarSyncStatus,
        googleCalendarEventId: bookings.googleCalendarEventId,
        massageNameSnapshot: bookings.massageNameSnapshot,
        durationMinutesSnapshot: bookings.durationMinutesSnapshot,
        durationLabelSnapshot: bookings.durationLabelSnapshot,
        requestedStartAt: bookings.requestedStartAt,
        requestedEndAt: bookings.requestedEndAt,
        confirmedStartAt: bookings.confirmedStartAt,
        confirmedEndAt: bookings.confirmedEndAt,
        locationType: bookings.locationType,
        mobileStreet: bookings.mobileStreet,
        mobileBuildingNumber: bookings.mobileBuildingNumber,
        mobileApartmentNumber: bookings.mobileApartmentNumber,
        mobilePostalCode: bookings.mobilePostalCode,
        mobileCity: bookings.mobileCity,
        customerFirstName: bookings.customerFirstName,
        customerLastName: bookings.customerLastName,
        customerPhone: bookings.customerPhone,
      })
      .from(bookings)
      .where(
        and(eq(bookings.id, bookingId), getAdminBookingScopeCondition(session)),
      )
      .for("update")
      .limit(1);

    if (!booking) {
      return { success: false, reason: "not_found" } as const;
    }

    if (booking.calendarSyncStatus !== "failed") {
      return { success: false, reason: "invalid_state" } as const;
    }

    const attemptedAt = new Date();

    try {
      const googleCalendarEventId = await upsertBookingGoogleCalendarEvent({
        ...booking,
        specialistId: booking.specialistId as BookingSpecialistId,
        requestedStartAt: booking.confirmedStartAt ?? booking.requestedStartAt,
        requestedEndAt: booking.confirmedEndAt ?? booking.requestedEndAt,
      });
      const syncedAt = new Date();

      await transaction
        .update(bookings)
        .set({
          calendarSyncStatus: "synced",
          googleCalendarEventId,
          calendarSyncLastError: null,
          calendarSyncAttemptedAt: attemptedAt,
          calendarSyncedAt: syncedAt,
          updatedAt: syncedAt,
        })
        .where(eq(bookings.id, booking.id));

      return {
        success: true,
        bookingId: booking.id,
        googleCalendarEventId,
      } as const;
    } catch (error) {
      const errorCode = getCalendarRetryErrorCode(error);
      const failedAt = new Date();

      await transaction
        .update(bookings)
        .set({
          calendarSyncStatus: "failed",
          calendarSyncLastError: errorCode,
          calendarSyncAttemptedAt: attemptedAt,
          calendarSyncedAt: null,
          updatedAt: failedAt,
        })
        .where(eq(bookings.id, booking.id));

      return {
        success: false,
        reason: "calendar_failure",
        errorCode,
      } as const;
    }
  });
};
