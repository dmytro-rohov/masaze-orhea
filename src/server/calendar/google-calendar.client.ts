import { google } from "googleapis";

// The JSON file is mounted into the runtime container; it must never be part
// of the repository, image layer, or Docker build arguments.
const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim();

if (!keyFile) {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_FILE is not configured");
}

const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.freebusy",
  ],
});

export const googleCalendar = google.calendar({
  version: "v3",
  auth,
});
