import { google } from "googleapis";

const keyFile = import.meta.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

if (!keyFile) {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_FILE is not configured");
}

const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ["https://www.googleapis.com/auth/calendar.freebusy"],
});

export const googleCalendar = google.calendar({
  version: "v3",
  auth,
});
