import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookings, specialists } from "@/db/schema";
import type { SpecialistId } from "@/data/specialists";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { getAdminBookingScopeCondition } from "@/server/admin/admin-bookings.service";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "@/server/calendar/google-calendar.service";
import { getSpecialistCalendarId } from "@/server/calendar/specialist-calendar.service";
import { assertBookingSlotAvailable } from "@/server/bookings/booking.availability";
import {
  createBookingGoogleCalendarEvent,
  getBookingGoogleCalendarEventId,
} from "@/server/bookings/booking-calendar-sync.service";
import { getBookingBufferMinutes } from "@/server/bookings/booking-settings.service";
import { assertBookingTimeWindow } from "@/server/bookings/booking-time-window.service";
import type { BookingSpecialistId } from "@/server/bookings/booking.types";

type ReassignmentFailureReason =
  | "forbidden"
  | "not_found"
  | "invalid_target"
  | "invalid_status"
  | "not_future"
  | "unavailable"
  | "configuration_failure"
  | "calendar_failure"
  | "concurrent_change";

export type AdminBookingReassignmentResult =
  | {
      success: true;
      bookingId: string;
      specialistId: SpecialistId;
      alreadyApplied: boolean;
    }
  | {
      success: false;
      reason: ReassignmentFailureReason;
      errorCode?: string;
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

const isBookingSpecialistId = (value: string): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

const getCalendarErrorCode = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "ADMIN_BOOKING_REASSIGNMENT_CALENDAR_FAILED";
  }

  switch (error.message) {
    case "SPECIALIST_CALENDAR_NOT_FOUND":
    case "GOOGLE_CALENDAR_EVENT_NOT_FOUND":
    case "GOOGLE_CALENDAR_EVENT_GET_FAILED":
    case "GOOGLE_CALENDAR_EVENT_CREATE_FAILED":
    case "GOOGLE_CALENDAR_EVENT_UPDATE_FAILED":
    case "GOOGLE_CALENDAR_EVENT_DELETE_FAILED":
    case "GOOGLE_CALENDAR_EVENT_ID_MISSING":
      return error.message;
    default:
      return "ADMIN_BOOKING_REASSIGNMENT_CALENDAR_FAILED";
  }
};

export const reassignAdminBooking = async (
  session: AdminSession,
  bookingId: string,
  targetSpecialistIdValue: string,
): Promise<AdminBookingReassignmentResult> => {
  if (!isOwner(session)) {
    return { success: false, reason: "forbidden" };
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bookingId,
    )
  ) {
    return { success: false, reason: "not_found" };
  }

  if (!isBookingSpecialistId(targetSpecialistIdValue)) {
    return { success: false, reason: "invalid_target" };
  }

  const targetSpecialistId = targetSpecialistIdValue;
  const [[booking], [targetSpecialist]] = await Promise.all([
    db
      .select({
        id: bookings.id,
        status: bookings.status,
        specialistId: bookings.specialistId,
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
        updatedAt: bookings.updatedAt,
      })
      .from(bookings)
      .where(
        and(eq(bookings.id, bookingId), getAdminBookingScopeCondition(session)),
      )
      .limit(1),
    db
      .select({ id: specialists.id, isActive: specialists.isActive })
      .from(specialists)
      .where(eq(specialists.id, targetSpecialistId))
      .limit(1),
  ]);

  if (!booking) {
    return { success: false, reason: "not_found" };
  }

  if (!targetSpecialist?.isActive) {
    return { success: false, reason: "invalid_target" };
  }

  if (booking.specialistId === targetSpecialistId) {
    return {
      success: true,
      bookingId: booking.id,
      specialistId: targetSpecialistId,
      alreadyApplied: true,
    };
  }

  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return { success: false, reason: "invalid_status" };
  }

  const startsAt = booking.confirmedStartAt ?? booking.requestedStartAt;
  const endsAt = booking.confirmedEndAt ?? booking.requestedEndAt;

  if (startsAt <= new Date()) {
    return { success: false, reason: "not_future" };
  }

  let oldCalendarId: string;
  let targetCalendarId: string;

  try {
    const bufferMinutes = await getBookingBufferMinutes();

    await assertBookingTimeWindow({
      specialistId: targetSpecialistId,
      startAt: startsAt,
      endAt: endsAt,
      bufferMinutes,
    });

    await assertBookingSlotAvailable({
      specialistId: targetSpecialistId,
      startAt: startsAt,
      endAt: endsAt,
      bufferMinutes,
      excludeBookingId: booking.id,
      excludeGoogleCalendarEventId: getBookingGoogleCalendarEventId(booking.id),
    });

    [oldCalendarId, targetCalendarId] = await Promise.all([
      getSpecialistCalendarId(booking.specialistId as BookingSpecialistId),
      getSpecialistCalendarId(targetSpecialistId),
    ]);

    if (oldCalendarId === targetCalendarId) {
      return {
        success: false,
        reason: "configuration_failure",
        errorCode: "SPECIALIST_CALENDARS_NOT_DISTINCT",
      };
    }
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
      return { success: false, reason: "unavailable", errorCode };
    }

    if (configurationErrorCodes.has(errorCode)) {
      return { success: false, reason: "configuration_failure", errorCode };
    }

    throw error;
  }

  const targetEventId = getBookingGoogleCalendarEventId(booking.id);
  const targetEvent = createBookingGoogleCalendarEvent({
    ...booking,
    specialistId: targetSpecialistId,
    requestedStartAt: startsAt,
    requestedEndAt: endsAt,
  });
  let oldEventRemoved = false;
  let targetEventPrepared = false;

  try {
    return await db.transaction(async (transaction) => {
      const [lockedBooking] = await transaction
        .select({
          status: bookings.status,
          specialistId: bookings.specialistId,
          requestedStartAt: bookings.requestedStartAt,
          requestedEndAt: bookings.requestedEndAt,
          confirmedStartAt: bookings.confirmedStartAt,
          confirmedEndAt: bookings.confirmedEndAt,
          googleCalendarEventId: bookings.googleCalendarEventId,
          updatedAt: bookings.updatedAt,
        })
        .from(bookings)
        .where(eq(bookings.id, booking.id))
        .for("update")
        .limit(1);

      if (
        !lockedBooking ||
        lockedBooking.specialistId !== booking.specialistId ||
        lockedBooking.status !== booking.status ||
        lockedBooking.updatedAt.getTime() !== booking.updatedAt.getTime()
      ) {
        return { success: false, reason: "concurrent_change" } as const;
      }

      const attemptedAt = new Date();

      try {
        if (booking.googleCalendarEventId) {
          try {
            await deleteGoogleCalendarEvent({
              calendarId: oldCalendarId,
              eventId: booking.googleCalendarEventId,
            });
            oldEventRemoved = true;
          } catch (error) {
            if (
              !(error instanceof Error) ||
              error.message !== "GOOGLE_CALENDAR_EVENT_NOT_FOUND"
            ) {
              throw error;
            }

            oldEventRemoved = true;
          }
        }

        let targetEventExists = false;

        try {
          await getGoogleCalendarEvent({
            calendarId: targetCalendarId,
            eventId: targetEventId,
          });
          targetEventExists = true;
        } catch (error) {
          if (
            !(error instanceof Error) ||
            error.message !== "GOOGLE_CALENDAR_EVENT_NOT_FOUND"
          ) {
            throw error;
          }
        }

        if (targetEventExists) {
          const { id: _eventId, ...updates } = targetEvent;

          await updateGoogleCalendarEvent({
            calendarId: targetCalendarId,
            eventId: targetEventId,
            updates,
          });
        } else {
          const createdEvent = await createGoogleCalendarEvent({
            calendarId: targetCalendarId,
            event: targetEvent,
          });

          if (!createdEvent.id) {
            throw new Error("GOOGLE_CALENDAR_EVENT_ID_MISSING");
          }
        }

        targetEventPrepared = true;
      } catch (error) {
        const errorCode = getCalendarErrorCode(error);

        await transaction
          .update(bookings)
          .set({
            calendarSyncStatus: "failed",
            calendarSyncLastError: errorCode,
            calendarSyncAttemptedAt: attemptedAt,
            calendarSyncedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking.id));

        return {
          success: false,
          reason: "calendar_failure",
          errorCode,
        } as const;
      }

      const syncedAt = new Date();

      await transaction
        .update(bookings)
        .set({
          specialistId: targetSpecialistId,
          googleCalendarEventId: targetEventId,
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
        specialistId: targetSpecialistId,
        alreadyApplied: false,
      } as const;
    });
  } catch (error) {
    if (oldEventRemoved || targetEventPrepared) {
      const failedAt = new Date();

      await db
        .update(bookings)
        .set({
          calendarSyncStatus: "failed",
          calendarSyncLastError: "ADMIN_BOOKING_REASSIGNMENT_PERSIST_FAILED",
          calendarSyncAttemptedAt: failedAt,
          calendarSyncedAt: null,
          updatedAt: failedAt,
        })
        .where(eq(bookings.id, booking.id));
    }

    throw error;
  }
};
