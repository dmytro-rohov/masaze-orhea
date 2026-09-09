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

export const getGoogleBusyPeriods = async ({
  calendarId,
  timeMin,
  timeMax,
}: GetGoogleBusyPeriodsInput): Promise<GoogleBusyPeriod[]> => {
  const response = await googleCalendar.freebusy.query({
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

  const calendar = response.data.calendars?.[calendarId];

  if (!calendar) {
    throw new Error("GOOGLE_CALENDAR_NOT_FOUND");
  }

  if (calendar.errors?.length) {
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
