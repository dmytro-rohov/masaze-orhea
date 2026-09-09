import type { APIRoute } from "astro";

import { getGoogleCalendarBusyPeriods } from "@/server/bookings/google-calendar";

export const GET: APIRoute = async () => {
  const calendarId = import.meta.env.GOOGLE_CALENDAR_TEST_ID;

  if (!calendarId) {
    return new Response(
      JSON.stringify({
        error: "GOOGLE_CALENDAR_TEST_ID is not configured",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const timeMin = new Date("2026-09-10T00:00:00+02:00");
    const timeMax = new Date("2026-09-11T00:00:00+02:00");

    const busy = await getGoogleCalendarBusyPeriods({
      calendarId,
      timeMin,
      timeMax,
    });

    return new Response(
      JSON.stringify(
        {
          calendarId,
          timeMin,
          timeMax,
          busy,
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Google Calendar smoke test failed:", error);

    return new Response(
      JSON.stringify({
        error: "GOOGLE_CALENDAR_TEST_FAILED",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
