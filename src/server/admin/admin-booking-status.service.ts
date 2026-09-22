import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookingEvents, bookingStatusEnum, bookings } from "@/db/schema";
import { deleteGoogleCalendarEvent } from "@/server/calendar/google-calendar.service";
import { getSpecialistBookingCalendarId } from "@/server/calendar/specialist-calendar.service";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { getAdminBookingScopeCondition } from "@/server/admin/admin-bookings.service";
import type { BookingSpecialistId } from "@/server/bookings/booking.types";
import { attemptBookingCustomerNotification } from "@/server/bookings/booking-customer-notification.service";

export type AdminBookingStatus = (typeof bookingStatusEnum.enumValues)[number];

export const adminBookingStatusTransitions: Record<
  AdminBookingStatus,
  readonly AdminBookingStatus[]
> = {
  pending: ["confirmed", "rejected"],
  confirmed: ["cancelled", "completed", "no_show"],
  cancelled: [],
  completed: [],
  rejected: [],
  no_show: [],
};

export type AdminBookingStatusMutationResult =
  | {
      success: true;
      bookingId: string;
      status: AdminBookingStatus;
      alreadyApplied: boolean;
      notificationSent?: boolean;
    }
  | {
      success: false;
      reason: "not_found" | "invalid_transition" | "calendar_failure";
      calendarErrorCode?: string;
    };

const statusesRequiringCalendarDeletion = new Set<AdminBookingStatus>([
  "rejected",
  "cancelled",
]);

const getCalendarDeletionErrorCode = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "ADMIN_BOOKING_CALENDAR_DELETE_FAILED";
  }

  switch (error.message) {
    case "SPECIALIST_BOOKING_CALENDAR_NOT_FOUND":
    case "GOOGLE_CALENDAR_EVENT_DELETE_FAILED":
      return error.message;
    default:
      return "ADMIN_BOOKING_CALENDAR_DELETE_FAILED";
  }
};

export const isAdminBookingStatus = (
  value: string,
): value is AdminBookingStatus =>
  Object.hasOwn(adminBookingStatusTransitions, value);

export const canTransitionAdminBookingStatus = (
  currentStatus: AdminBookingStatus,
  targetStatus: AdminBookingStatus,
): boolean =>
  adminBookingStatusTransitions[currentStatus].some(
    (allowedStatus) => allowedStatus === targetStatus,
  );

export const updateAdminBookingStatus = async (
  session: AdminSession,
  bookingId: string,
  targetStatus: AdminBookingStatus,
): Promise<AdminBookingStatusMutationResult> => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bookingId,
    )
  ) {
    return { success: false, reason: "not_found" };
  }

  let removedCalendarProjection = false;
  let mutationResult: AdminBookingStatusMutationResult;

  try {
    mutationResult = await db.transaction(async (transaction) => {
      const [booking] = await transaction
        .select({
          id: bookings.id,
          status: bookings.status,
          specialistId: bookings.specialistId,
          googleCalendarEventId: bookings.googleCalendarEventId,
          requestedStartAt: bookings.requestedStartAt,
          requestedEndAt: bookings.requestedEndAt,
          confirmedStartAt: bookings.confirmedStartAt,
          confirmedEndAt: bookings.confirmedEndAt,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.id, bookingId),
            getAdminBookingScopeCondition(session),
          ),
        )
        .for("update")
        .limit(1);

      if (!booking) {
        return { success: false, reason: "not_found" } as const;
      }

      if (booking.status === targetStatus) {
        return {
          success: true,
          bookingId: booking.id,
          status: targetStatus,
          alreadyApplied: true,
        } as const;
      }

      if (!canTransitionAdminBookingStatus(booking.status, targetStatus)) {
        return { success: false, reason: "invalid_transition" } as const;
      }

      const now = new Date();
      const mustDeleteCalendarEvent =
        statusesRequiringCalendarDeletion.has(targetStatus) &&
        booking.googleCalendarEventId !== null;

      if (mustDeleteCalendarEvent) {
        try {
          const calendarId = await getSpecialistBookingCalendarId(
            booking.specialistId as BookingSpecialistId,
          );

          await deleteGoogleCalendarEvent({
            calendarId,
            eventId: booking.googleCalendarEventId!,
          });
          removedCalendarProjection = true;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "GOOGLE_CALENDAR_EVENT_NOT_FOUND"
          ) {
            // The required projection state is already reached.
            removedCalendarProjection = true;
          } else {
            const calendarErrorCode = getCalendarDeletionErrorCode(error);

            await transaction
              .update(bookings)
              .set({
                calendarSyncStatus: "failed",
                calendarSyncLastError: calendarErrorCode,
                calendarSyncAttemptedAt: now,
                calendarSyncedAt: null,
                updatedAt: now,
              })
              .where(eq(bookings.id, booking.id));

            return {
              success: false,
              reason: "calendar_failure",
              calendarErrorCode,
            } as const;
          }
        }

        await transaction
          .update(bookings)
          .set({
            status: targetStatus,
            cancelledAt: targetStatus === "cancelled" ? now : undefined,
            rejectedAt: targetStatus === "rejected" ? now : undefined,
            calendarSyncStatus: "synced",
            googleCalendarEventId: null,
            calendarSyncLastError: null,
            calendarSyncAttemptedAt: now,
            calendarSyncedAt: now,
            updatedAt: now,
          })
          .where(eq(bookings.id, booking.id));
      } else {
        await transaction
          .update(bookings)
          .set({
            status: targetStatus,
            confirmedStartAt:
              targetStatus === "confirmed"
                ? (booking.confirmedStartAt ?? booking.requestedStartAt)
                : booking.confirmedStartAt,
            confirmedEndAt:
              targetStatus === "confirmed"
                ? (booking.confirmedEndAt ?? booking.requestedEndAt)
                : booking.confirmedEndAt,
            confirmedAt: targetStatus === "confirmed" ? now : undefined,
            updatedAt: now,
          })
          .where(eq(bookings.id, booking.id));
      }

      await transaction.insert(bookingEvents).values({
        bookingId: booking.id,
        eventType: "status_changed",
        fromStatus: booking.status,
        toStatus: targetStatus,
        actorUsername: session.username,
        actorRole: session.role,
        createdAt: now,
      });

      return {
        success: true,
        bookingId: booking.id,
        status: targetStatus,
        alreadyApplied: false,
      } as const;
    });
  } catch (error) {
    if (removedCalendarProjection) {
      const failedAt = new Date();

      try {
        await db
          .update(bookings)
          .set({
            calendarSyncStatus: "failed",
            calendarSyncLastError:
              "ADMIN_BOOKING_STATUS_PERSIST_FAILED_AFTER_CALENDAR_DELETE",
            calendarSyncAttemptedAt: failedAt,
            calendarSyncedAt: null,
            updatedAt: failedAt,
          })
          .where(
            and(
              eq(bookings.id, bookingId),
              getAdminBookingScopeCondition(session),
            ),
          );
      } catch (stateError) {
        console.error(
          "Admin booking calendar deletion recovery state update failed:",
          { bookingId, stateError },
        );
      }
    }

    throw error;
  }

  if (
    !mutationResult.success ||
    mutationResult.alreadyApplied ||
    !["confirmed", "cancelled", "completed", "rejected"].includes(
      mutationResult.status,
    )
  ) {
    return mutationResult;
  }

  const notificationSent = await attemptBookingCustomerNotification({
    bookingId: mutationResult.bookingId,
    event: mutationResult.status as
      | "confirmed"
      | "cancelled"
      | "completed"
      | "rejected",
    idempotencyKey: mutationResult.status,
  });

  return { ...mutationResult, notificationSent };
};
