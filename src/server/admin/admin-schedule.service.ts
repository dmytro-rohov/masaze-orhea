import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { bookingBlocksAvailability } from "@/server/bookings/booking-blocking.condition";

import { db } from "@/db";
import {
  bookings,
  specialistAvailabilityOverrides,
  specialistAvailabilityRules,
  specialists,
} from "@/db/schema";

import type { AdminSession } from "./admin-auth.service";
import { isOwner } from "./admin-authorization.service";

import { getSpecialistGoogleBusyPeriods } from "../bookings/booking.availability";

import { getSpecialistAvailabilitySettings } from "../bookings/booking-time-window.service";
import { getBookingZonedDateTime } from "../bookings/booking-time-zone";

import type { BookingSpecialistId } from "../bookings/booking.types";

import {
  getGoogleCalendarAllDayEvents,
  type GoogleCalendarAllDayEvent,
  type GoogleBusyPeriod,
} from "../calendar/google-calendar.service";

import { getSpecialistAvailabilityCalendarId } from "../calendar/specialist-calendar.service";

const ORHEA_DAY_OFF_EVENT_PREFIX = "orheaoff";

const ORHEA_DAY_OFF_EVENT_SUMMARY = "ORHEA — Dzień wolny";

export type AdminScheduleWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type AdminScheduleWorkingWindow = {
  id: string;
  weekday: AdminScheduleWeekday;
  startTime: string;
  endTime: string;
};

export type AdminScheduleOverride = {
  id: string;
  date: string;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
};

export type AdminScheduleBooking = {
  id: string;

  status: "pending" | "confirmed";

  customerName: string;
  massageName: string;

  startAt: Date;
  endAt: Date;
};

export type AdminScheduleGoogleBusyPeriod = {
  start: Date;
  end: Date;
};

export type AdminScheduleGoogleAllDayEvent = GoogleCalendarAllDayEvent;

export type AdminScheduleData = {
  specialist: {
    id: BookingSpecialistId;
    displayName: string;
    isActive: boolean;
  };

  settings: {
    minNoticeMinutes: number;
    maxAdvanceDays: number;
    maxBookingsPerDay: number | null;
  };

  weeklyRules: Record<AdminScheduleWeekday, AdminScheduleWorkingWindow[]>;

  overrides: AdminScheduleOverride[];

  bookings: AdminScheduleBooking[];

  googleBusyPeriods: AdminScheduleGoogleBusyPeriod[];

  googleAllDayEvents: AdminScheduleGoogleAllDayEvent[];

  googleBusyLoadFailed: boolean;

  googleAllDayLoadFailed: boolean;
};

export type AdminScheduleSpecialistOption = {
  id: BookingSpecialistId;
  displayName: string;
  isActive: boolean;
};

type GetAdminScheduleInput = {
  session: AdminSession;

  specialistId?: BookingSpecialistId;

  rangeStart: Date;
  rangeEnd: Date;
};

const effectiveBookingStart = sql<Date>`
    coalesce(
      ${bookings.confirmedStartAt},
      ${bookings.requestedStartAt}
    )
  `.mapWith(bookings.requestedStartAt);

const effectiveBookingEnd = sql<Date>`
    coalesce(
      ${bookings.confirmedEndAt},
      ${bookings.requestedEndAt}
    )
  `.mapWith(bookings.requestedEndAt);

const getEffectiveSpecialistId = (
  session: AdminSession,
  requestedSpecialistId?: BookingSpecialistId,
): BookingSpecialistId => {
  if (session.role === "specialist") {
    if (!session.specialistId) {
      throw new Error("ADMIN_SPECIALIST_SCOPE_INVALID");
    }

    return session.specialistId;
  }

  if (requestedSpecialistId) {
    return requestedSpecialistId;
  }

  return "adrian";
};

const isBookingSpecialistId = (value: string): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

export const getAdminScheduleSpecialists = async (
  session: AdminSession,
): Promise<AdminScheduleSpecialistOption[]> => {
  if (session.role === "specialist" && !session.specialistId) {
    throw new Error("ADMIN_SPECIALIST_SCOPE_INVALID");
  }

  const rows = await db
    .select({
      id: specialists.id,
      displayName: specialists.displayName,
      isActive: specialists.isActive,
    })
    .from(specialists)
    .where(
      session.role === "specialist" && session.specialistId
        ? eq(specialists.id, session.specialistId)
        : undefined,
    )
    .orderBy(asc(specialists.displayName));

  return rows.filter(
    (specialist): specialist is AdminScheduleSpecialistOption =>
      isBookingSpecialistId(specialist.id),
  );
};

const createEmptyWeeklyRules = (): Record<
  AdminScheduleWeekday,
  AdminScheduleWorkingWindow[]
> => ({
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
});

const isOrheaDayOffProjection = (event: GoogleCalendarAllDayEvent): boolean => {
  const hasOrheaId =
    typeof event.id === "string" &&
    event.id.startsWith(ORHEA_DAY_OFF_EVENT_PREFIX);

  const hasOrheaSummary = event.summary === ORHEA_DAY_OFF_EVENT_SUMMARY;

  return hasOrheaId || hasOrheaSummary;
};

const isBusyPeriodRepresentedByAllDayEvent = (
  busyPeriod: GoogleBusyPeriod,
  allDayEvents: GoogleCalendarAllDayEvent[],
): boolean =>
  allDayEvents.some(
    (event) =>
      event.start.getTime() === busyPeriod.start.getTime() &&
      event.end.getTime() === busyPeriod.end.getTime(),
  );

export const getAdminSchedule = async ({
  session,
  specialistId,
  rangeStart,
  rangeEnd,
}: GetAdminScheduleInput): Promise<AdminScheduleData> => {
  const effectiveSpecialistId = getEffectiveSpecialistId(session, specialistId);
  const currentScheduleDate = getBookingZonedDateTime(rangeStart).dateKey;

  if (!isOwner(session) && session.specialistId !== effectiveSpecialistId) {
    throw new Error("ADMIN_SPECIALIST_SCOPE_FORBIDDEN");
  }

  const [specialist] = await db
    .select({
      id: specialists.id,

      displayName: specialists.displayName,

      isActive: specialists.isActive,
    })
    .from(specialists)
    .where(eq(specialists.id, effectiveSpecialistId))
    .limit(1);

  if (!specialist) {
    throw new Error("SPECIALIST_NOT_FOUND");
  }

  const [settings, weeklyRuleRows, overrideRows, bookingRows] =
    await Promise.all([
      getSpecialistAvailabilitySettings(effectiveSpecialistId),

      db
        .select({
          id: specialistAvailabilityRules.id,

          weekday: specialistAvailabilityRules.weekday,

          startTime: specialistAvailabilityRules.startTime,

          endTime: specialistAvailabilityRules.endTime,
        })
        .from(specialistAvailabilityRules)
        .where(
          and(
            eq(specialistAvailabilityRules.specialistId, effectiveSpecialistId),

            eq(specialistAvailabilityRules.isActive, true),
          ),
        )
        .orderBy(
          asc(specialistAvailabilityRules.weekday),

          asc(specialistAvailabilityRules.startTime),
        ),

      db
        .select({
          id: specialistAvailabilityOverrides.id,

          date: specialistAvailabilityOverrides.date,

          isAvailable: specialistAvailabilityOverrides.isAvailable,

          startTime: specialistAvailabilityOverrides.startTime,

          endTime: specialistAvailabilityOverrides.endTime,
        })
        .from(specialistAvailabilityOverrides)
        .where(
          and(
            eq(
              specialistAvailabilityOverrides.specialistId,
              effectiveSpecialistId,
            ),

            sql<boolean>`
              ${specialistAvailabilityOverrides.date}
              >=
              ${currentScheduleDate}
            `,
          ),
        )
        .orderBy(asc(specialistAvailabilityOverrides.date)),

      db
        .select({
          id: bookings.id,

          status: bookings.status,

          customerFirstName: bookings.customerFirstName,

          customerLastName: bookings.customerLastName,

          massageName: bookings.massageNameSnapshot,

          requestedStartAt: bookings.requestedStartAt,

          requestedEndAt: bookings.requestedEndAt,

          confirmedStartAt: bookings.confirmedStartAt,

          confirmedEndAt: bookings.confirmedEndAt,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.specialistId, effectiveSpecialistId),

            bookingBlocksAvailability,

            lt(effectiveBookingStart, rangeEnd),

            gt(effectiveBookingEnd, rangeStart),
          ),
        )
        .orderBy(asc(effectiveBookingStart)),
    ]);

  const weeklyRules = createEmptyWeeklyRules();

  for (const rule of weeklyRuleRows) {
    weeklyRules[rule.weekday].push({
      id: rule.id,

      weekday: rule.weekday,

      startTime: rule.startTime,

      endTime: rule.endTime,
    });
  }

  const scheduleBookings: AdminScheduleBooking[] = bookingRows.map(
    (booking) => {
      const startAt = booking.confirmedStartAt ?? booking.requestedStartAt;

      const endAt = booking.confirmedEndAt ?? booking.requestedEndAt;

      return {
        id: booking.id,

        status: booking.status as "pending" | "confirmed",

        customerName:
          `${booking.customerFirstName} ${booking.customerLastName}`.trim(),

        massageName: booking.massageName,

        startAt,

        endAt,
      };
    },
  );

  let rawGoogleBusyPeriods: GoogleBusyPeriod[] = [];

  let rawGoogleAllDayEvents: GoogleCalendarAllDayEvent[] = [];

  let googleBusyLoadFailed = false;

  let googleAllDayLoadFailed = false;

  let calendarId: string | null = null;

  try {
    calendarId = await getSpecialistAvailabilityCalendarId(
      effectiveSpecialistId,
    );
  } catch (error) {
    googleBusyLoadFailed = true;

    googleAllDayLoadFailed = true;

    console.error("Admin schedule specialist calendar loading failed:", {
      specialistId: effectiveSpecialistId,

      error,
    });
  }

  if (calendarId) {
    const [busyResult, allDayResult] = await Promise.allSettled([
      getSpecialistGoogleBusyPeriods({
        specialistId: effectiveSpecialistId,

        timeMin: rangeStart,

        timeMax: rangeEnd,
      }),

      getGoogleCalendarAllDayEvents({
        calendarId,

        timeMin: rangeStart,

        timeMax: rangeEnd,
      }),
    ]);

    if (busyResult.status === "fulfilled") {
      rawGoogleBusyPeriods = busyResult.value;
    } else {
      googleBusyLoadFailed = true;

      console.error("Admin schedule Google busy loading failed:", {
        specialistId: effectiveSpecialistId,

        error: busyResult.reason,
      });
    }

    if (allDayResult.status === "fulfilled") {
      rawGoogleAllDayEvents = allDayResult.value;
    } else {
      googleAllDayLoadFailed = true;

      console.error("Admin schedule Google all-day loading failed:", {
        specialistId: effectiveSpecialistId,

        error: allDayResult.reason,
      });
    }
  }

  /**
   * Wszystkie Google all-day events
   * pobieramy normalnie, bo są potrzebne
   * również do rozpoznania FreeBusy.
   *
   * Dopiero na końcu usuwamy z widoku
   * projekcje utworzone przez ORHEA.
   */
  const googleAllDayEvents = rawGoogleAllDayEvents.filter(
    (event) => !isOrheaDayOffProjection(event),
  );

  /**
   * Z Google Busy usuwamy wszystkie
   * zakresy odpowiadające eventom
   * całodniowym.
   *
   * W efekcie:
   *
   * - ORHEA dzień wolny:
   *   widoczny tylko jako ORHEA override
   *
   * - ręczny Google all-day:
   *   widoczny tylko jako całodniowa zajętość Google
   *
   * - Google timed event:
   *   widoczny jako Google Busy
   */
  const googleBusyPeriods = googleAllDayLoadFailed
    ? rawGoogleBusyPeriods
    : rawGoogleBusyPeriods.filter(
        (period) =>
          !isBusyPeriodRepresentedByAllDayEvent(period, rawGoogleAllDayEvents),
      );

  return {
    specialist: {
      id: specialist.id as BookingSpecialistId,

      displayName: specialist.displayName,

      isActive: specialist.isActive,
    },

    settings,

    weeklyRules,

    overrides: overrideRows,

    bookings: scheduleBookings,

    googleBusyPeriods,

    googleAllDayEvents,

    googleBusyLoadFailed,

    googleAllDayLoadFailed,
  };
};
