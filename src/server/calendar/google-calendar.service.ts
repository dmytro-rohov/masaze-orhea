import type { calendar_v3 } from "googleapis";

import { googleCalendar } from "./google-calendar.client";
import { createBookingDateTime } from "../bookings/booking-time-zone";

export type GoogleBusyPeriod = {
  start: Date;
  end: Date;
};

export type GoogleCalendarAllDayEvent = {
  id: string | null;
  summary: string;
  startDate: string;
  endDateExclusive: string;
  start: Date;
  end: Date;
};

type GetGoogleBusyPeriodsInput = {
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
};

type GetGoogleCalendarAllDayEventsInput = {
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
};

type GoogleCalendarEventReference = {
  calendarId: string;
  eventId: string;
};

type CreateGoogleCalendarEventInput = {
  calendarId: string;
  event: calendar_v3.Schema$Event;
};

type UpdateGoogleCalendarEventInput = GoogleCalendarEventReference & {
  updates: calendar_v3.Schema$Event;
};

const isGoogleCalendarNotFoundError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("code" in error && (error.code === 404 || error.code === 410)) {
    return true;
  }

  if (!("response" in error)) {
    return false;
  }

  const response = error.response;

  return (
    typeof response === "object" &&
    response !== null &&
    "status" in response &&
    (response.status === 404 || response.status === 410)
  );
};

const listGoogleCalendarEvents = async ({
  calendarId,
  timeMin,
  timeMax,
}: {
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<calendar_v3.Schema$Event[]> => {
  const events: calendar_v3.Schema$Event[] = [];

  let pageToken: string | undefined;

  try {
    do {
      const response = await googleCalendar.events.list({
        calendarId,

        timeMin: timeMin.toISOString(),

        timeMax: timeMax.toISOString(),

        timeZone: "Europe/Warsaw",

        singleEvents: true,

        showDeleted: false,

        maxResults: 2500,

        pageToken,
      });

      events.push(...(response.data.items ?? []));

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (error) {
    console.error("Google Calendar events request failed:", error);

    throw new Error("GOOGLE_CALENDAR_UNAVAILABLE");
  }

  return events;
};

export const getGoogleBusyPeriods = async ({
  calendarId,
  timeMin,
  timeMax,
}: GetGoogleBusyPeriodsInput): Promise<GoogleBusyPeriod[]> => {
  let response;

  try {
    response = await googleCalendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),

        timeMax: timeMax.toISOString(),

        timeZone: "Europe/Warsaw",

        items: [
          {
            id: calendarId,
          },
        ],
      },
    });
  } catch (error) {
    console.error("Google Calendar API request failed:", error);

    throw new Error("GOOGLE_CALENDAR_UNAVAILABLE");
  }

  const calendar = response.data.calendars?.[calendarId];

  if (!calendar) {
    throw new Error("GOOGLE_CALENDAR_NOT_FOUND");
  }

  if (calendar.errors?.length) {
    console.error("Google Calendar returned calendar errors:", calendar.errors);

    throw new Error("GOOGLE_CALENDAR_QUERY_FAILED");
  }

  return (calendar.busy ?? [])
    .filter(
      (
        period,
      ): period is {
        start: string;
        end: string;
      } => typeof period.start === "string" && typeof period.end === "string",
    )
    .map((period) => ({
      start: new Date(period.start),
      end: new Date(period.end),
    }));
};

export const getGoogleCalendarAllDayEvents = async ({
  calendarId,
  timeMin,
  timeMax,
}: GetGoogleCalendarAllDayEventsInput): Promise<
  GoogleCalendarAllDayEvent[]
> => {
  const events = await listGoogleCalendarEvents({
    calendarId,
    timeMin,
    timeMax,
  });

  return events.flatMap((event) => {
    if (event.status === "cancelled" || event.transparency === "transparent") {
      return [];
    }

    const startDate = event.start?.date;

    const endDateExclusive = event.end?.date;

    if (!startDate || !endDateExclusive) {
      return [];
    }

    let start: Date;
    let end: Date;

    try {
      start = createBookingDateTime(startDate, 0);

      end = createBookingDateTime(endDateExclusive, 0);
    } catch {
      return [];
    }

    if (end <= start) {
      return [];
    }

    return [
      {
        id: event.id ?? null,

        summary: event.summary?.trim() || "Zajęty cały dzień",

        startDate,

        endDateExclusive,

        start,

        end,
      },
    ];
  });
};

export const createGoogleCalendarEvent = async ({
  calendarId,
  event,
}: CreateGoogleCalendarEventInput): Promise<calendar_v3.Schema$Event> => {
  try {
    const response = await googleCalendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return response.data;
  } catch (error) {
    console.error("Google Calendar event creation failed:", error);

    throw new Error("GOOGLE_CALENDAR_EVENT_CREATE_FAILED");
  }
};

export const getGoogleCalendarEvent = async ({
  calendarId,
  eventId,
}: GoogleCalendarEventReference): Promise<calendar_v3.Schema$Event> => {
  try {
    const response = await googleCalendar.events.get({
      calendarId,
      eventId,
    });

    return response.data;
  } catch (error) {
    console.error("Google Calendar event retrieval failed:", error);

    if (isGoogleCalendarNotFoundError(error)) {
      throw new Error("GOOGLE_CALENDAR_EVENT_NOT_FOUND");
    }

    throw new Error("GOOGLE_CALENDAR_EVENT_GET_FAILED");
  }
};

export const updateGoogleCalendarEvent = async ({
  calendarId,
  eventId,
  updates,
}: UpdateGoogleCalendarEventInput): Promise<calendar_v3.Schema$Event> => {
  try {
    const response = await googleCalendar.events.patch({
      calendarId,
      eventId,
      requestBody: updates,
    });

    return response.data;
  } catch (error) {
    console.error("Google Calendar event update failed:", error);

    if (isGoogleCalendarNotFoundError(error)) {
      throw new Error("GOOGLE_CALENDAR_EVENT_NOT_FOUND");
    }

    throw new Error("GOOGLE_CALENDAR_EVENT_UPDATE_FAILED");
  }
};

export const deleteGoogleCalendarEvent = async ({
  calendarId,
  eventId,
}: GoogleCalendarEventReference): Promise<void> => {
  try {
    await googleCalendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error) {
    console.error("Google Calendar event deletion failed:", error);

    if (isGoogleCalendarNotFoundError(error)) {
      throw new Error("GOOGLE_CALENDAR_EVENT_NOT_FOUND");
    }

    throw new Error("GOOGLE_CALENDAR_EVENT_DELETE_FAILED");
  }
};
