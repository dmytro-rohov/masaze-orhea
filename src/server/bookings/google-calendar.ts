import { google } from "googleapis";

const keyFile = import.meta.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

if (!keyFile) {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_FILE is not configured");
}

const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ["https://www.googleapis.com/auth/calendar.freebusy"],
});

const calendar = google.calendar({
  version: "v3",
  auth,
});

export const getGoogleCalendarBusyPeriods = async ({
  calendarId,
  timeMin,
  timeMax,
}: {
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
}) => {
  const response = await calendar.freebusy.query({
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

  return response.data.calendars?.[calendarId]?.busy ?? [];
};
