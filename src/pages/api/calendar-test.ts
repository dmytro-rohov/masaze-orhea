import type { APIRoute } from "astro";

import { getSpecialistCalendarId } from "../../server/calendar/specialist-calendar.service";
import { getGoogleBusyPeriods } from "../../server/calendar/google-calendar.service";

export const GET: APIRoute = async () => {
  try {
    const specialistId = "adrian";

    const calendarId = await getSpecialistCalendarId(specialistId);

    const timeMin = new Date("2026-09-10T00:00:00+02:00");

    const timeMax = new Date("2026-09-11T00:00:00+02:00");

    const busy = await getGoogleBusyPeriods({
      calendarId,
      timeMin,
      timeMax,
    });

    return new Response(
      JSON.stringify(
        {
          specialistId,
          calendarId,
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
    console.error("Specialist calendar test failed:", error);

    return new Response(
      JSON.stringify({
        error: "SPECIALIST_CALENDAR_TEST_FAILED",
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
