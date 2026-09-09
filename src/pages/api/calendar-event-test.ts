import type { APIContext } from "astro";
import type { calendar_v3 } from "googleapis";

import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "../../server/calendar/google-calendar.service";

export const prerender = false;

const calendarId = import.meta.env.GOOGLE_CALENDAR_TEST_ID;
const testApiKey = import.meta.env.GOOGLE_CALENDAR_TEST_API_KEY;

const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const getEventIdFromUrl = (request: Request): string | null => {
  const eventId = new URL(request.url).searchParams.get("eventId");

  return eventId?.trim() || null;
};

const validateEventDateTime = (
  value: unknown,
): value is calendar_v3.Schema$EventDateTime =>
  isRecord(value) &&
  (isNonEmptyString(value.dateTime) || isNonEmptyString(value.date));

const getConfigurationError = (): Response | null => {
  if (!calendarId || !testApiKey) {
    return createJsonResponse(
      {
        success: false,
        error: "CALENDAR_EVENT_TEST_NOT_CONFIGURED",
      },
      503,
    );
  }

  return null;
};

const authorizeRequest = (request: Request): Response | null => {
  const configurationError = getConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  if (request.headers.get("x-calendar-test-key") !== testApiKey) {
    return createJsonResponse(
      {
        success: false,
        error: "CALENDAR_EVENT_TEST_UNAUTHORIZED",
      },
      401,
    );
  }

  return null;
};

const readJsonBody = async (
  request: Request,
): Promise<Record<string, unknown> | null> => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    const body: unknown = await request.json();

    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
};

const createErrorResponse = (error: unknown): Response => {
  console.error("Google Calendar event test failed:", error);

  if (error instanceof Error) {
    if (error.message === "GOOGLE_CALENDAR_EVENT_NOT_FOUND") {
      return createJsonResponse(
        {
          success: false,
          error: error.message,
        },
        404,
      );
    }

    if (error.message.startsWith("GOOGLE_CALENDAR_EVENT_")) {
      return createJsonResponse(
        {
          success: false,
          error: error.message,
        },
        502,
      );
    }
  }

  return createJsonResponse(
    {
      success: false,
      error: "CALENDAR_EVENT_TEST_FAILED",
    },
    500,
  );
};

export async function POST({ request }: APIContext) {
  const authorizationError = authorizeRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  const body = await readJsonBody(request);

  if (
    !body ||
    !isNonEmptyString(body.summary) ||
    !validateEventDateTime(body.start) ||
    !validateEventDateTime(body.end)
  ) {
    return createJsonResponse(
      {
        success: false,
        error: "CALENDAR_EVENT_TEST_INVALID_EVENT",
      },
      400,
    );
  }

  const event: calendar_v3.Schema$Event = {
    summary: body.summary.trim(),
    start: body.start,
    end: body.end,
  };

  if (isNonEmptyString(body.description)) {
    event.description = body.description.trim();
  }

  if (isNonEmptyString(body.location)) {
    event.location = body.location.trim();
  }

  try {
    const createdEvent = await createGoogleCalendarEvent({
      calendarId,
      event,
    });

    return createJsonResponse(
      {
        success: true,
        event: createdEvent,
      },
      201,
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function GET({ request }: APIContext) {
  const authorizationError = authorizeRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  const eventId = getEventIdFromUrl(request);

  if (!eventId) {
    return createJsonResponse(
      {
        success: false,
        error: "CALENDAR_EVENT_TEST_EVENT_ID_REQUIRED",
      },
      400,
    );
  }

  try {
    const event = await getGoogleCalendarEvent({
      calendarId,
      eventId,
    });

    return createJsonResponse({
      success: true,
      event,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function PATCH({ request }: APIContext) {
  const authorizationError = authorizeRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  const body = await readJsonBody(request);

  if (!body || !isNonEmptyString(body.eventId) || !isRecord(body.updates)) {
    return createJsonResponse(
      {
        success: false,
        error: "CALENDAR_EVENT_TEST_INVALID_UPDATE",
      },
      400,
    );
  }

  try {
    const event = await updateGoogleCalendarEvent({
      calendarId,
      eventId: body.eventId.trim(),
      updates: body.updates,
    });

    return createJsonResponse({
      success: true,
      event,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function DELETE({ request }: APIContext) {
  const authorizationError = authorizeRequest(request);

  if (authorizationError) {
    return authorizationError;
  }

  const eventId = getEventIdFromUrl(request);

  if (!eventId) {
    return createJsonResponse(
      {
        success: false,
        error: "CALENDAR_EVENT_TEST_EVENT_ID_REQUIRED",
      },
      400,
    );
  }

  try {
    await deleteGoogleCalendarEvent({
      calendarId,
      eventId,
    });

    return createJsonResponse({
      success: true,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
