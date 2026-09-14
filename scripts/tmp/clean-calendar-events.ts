import { config } from "dotenv";
import pg from "pg";
import { google } from "googleapis";

async function main() {
  config({ path: ".env" });
  config({ path: ".env.local", override: true });

  const databaseUrl = process.env.DATABASE_URL;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  if (!keyFile) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_FILE is missing");
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
  });

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
    });

    const calendar = google.calendar({
      version: "v3",
      auth,
    });

    const { rows } = await pool.query(`
      SELECT
        b.id AS booking_id,
        b.google_calendar_event_id AS event_id,
        sc.google_calendar_id AS calendar_id
      FROM bookings b
      JOIN specialist_calendars sc
        ON sc.specialist_id = b.specialist_id
      WHERE b.google_calendar_event_id IS NOT NULL
    `);

    console.log(`Found ${rows.length} ORHEA calendar events.`);

    for (const row of rows) {
      try {
        await calendar.events.delete({
          calendarId: row.calendar_id,
          eventId: row.event_id,
        });

        console.log(
          `Deleted booking ${row.booking_id}: ${row.event_id}`,
        );
      } catch (error: any) {
        const status = error?.response?.status ?? error?.code;

        if (status === 404 || status === 410) {
          console.log(
            `Already missing booking ${row.booking_id}: ${row.event_id}`,
          );
          continue;
        }

        console.error(
          `FAILED booking ${row.booking_id}: ${row.event_id}`,
          error,
        );

        process.exitCode = 1;
        break;
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
