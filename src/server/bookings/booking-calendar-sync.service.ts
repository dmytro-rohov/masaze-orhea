import { eq } from "drizzle-orm";
import type { calendar_v3 } from "googleapis";

import { db } from "@/db";
import { bookings } from "@/db/schema";

import {
  createGoogleCalendarEvent,
  getGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "../calendar/google-calendar.service";
import { getSpecialistCalendarId } from "../calendar/specialist-calendar.service";

import type { BookingSpecialistId } from "./booking.types";

export type BookingCalendarSyncInput = Pick<
  typeof bookings.$inferSelect,
  | "id"
  | "massageNameSnapshot"
  | "durationMinutesSnapshot"
  | "durationLabelSnapshot"
  | "requestedStartAt"
  | "requestedEndAt"
  | "locationType"
  | "mobileStreet"
  | "mobileBuildingNumber"
  | "mobileApartmentNumber"
  | "mobilePostalCode"
  | "mobileCity"
  | "customerFirstName"
  | "customerLastName"
  | "customerPhone"
> & {
  specialistId: BookingSpecialistId;
};

const GOOGLE_CALENDAR_TIME_ZONE = "Europe/Warsaw";

export const getBookingGoogleCalendarEventId = (bookingId: string): string =>
  bookingId.replaceAll("-", "").toLowerCase();

const getDurationLabel = (booking: BookingCalendarSyncInput): string => {
  if (booking.durationLabelSnapshot) {
    return booking.durationLabelSnapshot;
  }

  return `${booking.durationMinutesSnapshot} min`;
};

const getMobileAddress = (booking: BookingCalendarSyncInput): string | null => {
  if (
    booking.locationType !== "mobile" ||
    !booking.mobileStreet ||
    !booking.mobileBuildingNumber ||
    !booking.mobilePostalCode ||
    !booking.mobileCity
  ) {
    return null;
  }

  const apartmentNumber = booking.mobileApartmentNumber
    ? `/${booking.mobileApartmentNumber}`
    : "";

  return `${booking.mobileStreet} ${booking.mobileBuildingNumber}${apartmentNumber}, ${booking.mobilePostalCode} ${booking.mobileCity}`;
};

export const createBookingGoogleCalendarEvent = (
  booking: BookingCalendarSyncInput,
): calendar_v3.Schema$Event => {
  const durationLabel = getDurationLabel(booking);
  const mobileAddress = getMobileAddress(booking);
  const description = [
    `Klient: ${booking.customerFirstName} ${booking.customerLastName}`,
    booking.customerPhone ? `Telefon: ${booking.customerPhone}` : null,
    `Booking ID: ${booking.id}`,
    `Wariant: ${durationLabel}`,
    `Lokalizacja: ${booking.locationType === "mobile" ? "mobilnie" : "salon"}`,
    mobileAddress ? `Adres: ${mobileAddress}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    id: getBookingGoogleCalendarEventId(booking.id),
    summary: `ORHEA — ${booking.massageNameSnapshot} — ${durationLabel}`,
    description,
    start: {
      dateTime: booking.requestedStartAt.toISOString(),
      timeZone: GOOGLE_CALENDAR_TIME_ZONE,
    },
    end: {
      dateTime: booking.requestedEndAt.toISOString(),
      timeZone: GOOGLE_CALENDAR_TIME_ZONE,
    },
    transparency: "opaque",
  };
};

type UpsertBookingGoogleCalendarEventInput = BookingCalendarSyncInput & {
  googleCalendarEventId?: string | null;
};

export const upsertBookingGoogleCalendarEvent = async (
  booking: UpsertBookingGoogleCalendarEventInput,
): Promise<string> => {
  const calendarId = await getSpecialistCalendarId(booking.specialistId);
  const event = createBookingGoogleCalendarEvent(booking);
  const deterministicEventId = getBookingGoogleCalendarEventId(booking.id);
  const eventIds = Array.from(
    new Set(
      [booking.googleCalendarEventId, deterministicEventId].filter(
        (eventId): eventId is string => Boolean(eventId),
      ),
    ),
  );
  const { id: _eventId, ...updates } = event;

  for (const eventId of eventIds) {
    try {
      await getGoogleCalendarEvent({ calendarId, eventId });
      const updatedEvent = await updateGoogleCalendarEvent({
        calendarId,
        eventId,
        updates,
      });

      return updatedEvent.id ?? eventId;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "GOOGLE_CALENDAR_EVENT_NOT_FOUND"
      ) {
        throw error;
      }
    }
  }

  const createdEvent = await createGoogleCalendarEvent({ calendarId, event });

  if (!createdEvent.id) {
    throw new Error("GOOGLE_CALENDAR_EVENT_ID_MISSING");
  }

  return createdEvent.id;
};

const getCalendarSyncErrorCode = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "BOOKING_CALENDAR_SYNC_FAILED";
  }

  switch (error.message) {
    case "SPECIALIST_CALENDAR_NOT_FOUND":
    case "GOOGLE_CALENDAR_EVENT_CREATE_FAILED":
    case "GOOGLE_CALENDAR_EVENT_ID_MISSING":
      return error.message;
    default:
      return "BOOKING_CALENDAR_SYNC_FAILED";
  }
};

export const syncBookingToGoogleCalendar = async (
  booking: BookingCalendarSyncInput,
): Promise<void> => {
  const attemptedAt = new Date();
  let googleCalendarEventId: string;

  try {
    const calendarId = await getSpecialistCalendarId(booking.specialistId);

    const event = await createGoogleCalendarEvent({
      calendarId,
      event: createBookingGoogleCalendarEvent(booking),
    });

    if (!event.id) {
      throw new Error("GOOGLE_CALENDAR_EVENT_ID_MISSING");
    }

    googleCalendarEventId = event.id;
  } catch (error) {
    const failedAt = new Date();
    const errorCode = getCalendarSyncErrorCode(error);

    console.error("Booking Google Calendar synchronization failed:", {
      bookingId: booking.id,
      errorCode,
      error,
    });

    await db
      .update(bookings)
      .set({
        calendarSyncStatus: "failed",
        googleCalendarEventId: null,
        calendarSyncLastError: errorCode,
        calendarSyncAttemptedAt: attemptedAt,
        calendarSyncedAt: null,
        updatedAt: failedAt,
      })
      .where(eq(bookings.id, booking.id));

    return;
  }

  const syncedAt = new Date();

  await db
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
};
