import type { calendar_v3 } from "googleapis";

import { googleCalendar } from "./google-calendar.client";

export type GoogleBusyPeriod = {
  start: Date;
  end: Date;
};

type GetGoogleBusyPeriodsInput = {
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

  if ("code" in error && error.code === 404) {
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
    response.status === 404
  );
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
