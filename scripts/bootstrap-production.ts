import "dotenv/config";

import { and, eq } from "drizzle-orm";

import { db } from "../src/db";
import {
  bookingSettings,
  GLOBAL_BOOKING_SETTINGS_ID,
  specialistAvailabilitySettings,
  specialistCalendars,
  specialists,
} from "../src/db/schema";

type SpecialistId = "adrian" | "aleksandra";
type CalendarPurpose = "availability" | "bookings";

type CalendarBootstrapInput = {
  specialistId: SpecialistId;
  purpose: CalendarPurpose;
  environmentVariable: string;
  label: string;
};

const requiredEnvironmentValue = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`BOOTSTRAP_${name}_REQUIRED`);
  }

  if (value.length > 500) {
    throw new Error(`BOOTSTRAP_${name}_INVALID`);
  }

  return value;
};

const calendarInputs: CalendarBootstrapInput[] = [
  {
    specialistId: "adrian",
    purpose: "availability",
    environmentVariable: "GOOGLE_ADRIAN_AVAILABILITY_CALENDAR_ID",
    label: "Kalendarz dostępności Adriana",
  },
  {
    specialistId: "adrian",
    purpose: "bookings",
    environmentVariable: "GOOGLE_ADRIAN_BOOKINGS_CALENDAR_ID",
    label: "Kalendarz rezerwacji Adriana",
  },
  {
    specialistId: "aleksandra",
    purpose: "availability",
    environmentVariable: "GOOGLE_ALEKSANDRA_AVAILABILITY_CALENDAR_ID",
    label: "Kalendarz dostępności Aleksandry",
  },
  {
    specialistId: "aleksandra",
    purpose: "bookings",
    environmentVariable: "GOOGLE_ALEKSANDRA_BOOKINGS_CALENDAR_ID",
    label: "Kalendarz rezerwacji Aleksandry",
  },
];

const calendarIds = new Map(
  calendarInputs.map((input) => [
    input.environmentVariable,
    requiredEnvironmentValue(input.environmentVariable),
  ]),
);

if (new Set(calendarIds.values()).size !== calendarIds.size) {
  throw new Error("BOOTSTRAP_CALENDAR_IDS_MUST_BE_UNIQUE");
}

const initialSpecialists: ReadonlyArray<{ id: SpecialistId; displayName: string }> = [
  { id: "adrian", displayName: "Adrian" },
  { id: "aleksandra", displayName: "Aleksandra" },
];

await db.transaction(async (tx) => {
  for (const specialist of initialSpecialists) {
    await tx.insert(specialists).values({ ...specialist, isActive: true }).onConflictDoNothing();
  }

  await tx
    .insert(bookingSettings)
    .values({
      id: GLOBAL_BOOKING_SETTINGS_ID,
      // Existing project defaults. The bootstrap never overwrites owner edits.
      bufferMinutes: 30,
      slotStepMinutes: 30,
    })
    .onConflictDoNothing();

  for (const specialist of initialSpecialists) {
    await tx
      .insert(specialistAvailabilitySettings)
      .values({
        specialistId: specialist.id,
        // Schema defaults: no weekly schedule is inferred here.
        minNoticeMinutes: 240,
        maxAdvanceDays: 60,
        maxBookingsPerDay: null,
      })
      .onConflictDoNothing();
  }

  for (const input of calendarInputs) {
    const configuredCalendarId = calendarIds.get(input.environmentVariable)!;
    const [existing] = await tx
      .select({ googleCalendarId: specialistCalendars.googleCalendarId })
      .from(specialistCalendars)
      .where(
        and(
          eq(specialistCalendars.specialistId, input.specialistId),
          eq(specialistCalendars.purpose, input.purpose),
        ),
      )
      .limit(1);

    if (existing && existing.googleCalendarId !== configuredCalendarId) {
      throw new Error(
        `BOOTSTRAP_CALENDAR_MAPPING_CONFLICT_${input.specialistId.toUpperCase()}_${input.purpose.toUpperCase()}`,
      );
    }

    if (!existing) {
      await tx.insert(specialistCalendars).values({
        specialistId: input.specialistId,
        purpose: input.purpose,
        googleCalendarId: configuredCalendarId,
        label: input.label,
        isActive: true,
      });
    }
  }
});

console.info("Production bootstrap completed.");
