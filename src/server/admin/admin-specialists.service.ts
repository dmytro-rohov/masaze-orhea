import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  bookings,
  specialistAvailabilitySettings,
  specialistCalendars,
  specialists,
} from "@/db/schema";

import type { BookingSpecialistId } from "../bookings/booking.types";
import type { AdminSession } from "./admin-auth.service";
import { isOwner } from "./admin-authorization.service";

export type AdminSpecialistCalendarStatus =
  "active" | "inactive" | "not_configured";

export type AdminSpecialistListItem = {
  id: BookingSpecialistId;

  displayName: string;

  isActive: boolean;

  availability: {
    minNoticeMinutes: number;
    maxAdvanceDays: number;
    maxBookingsPerDay: number | null;
  } | null;

  calendar: {
    id: string;
    googleCalendarId: string;
    label: string | null;
    isActive: boolean;
    status: AdminSpecialistCalendarStatus;
  } | null;

  activeBookingsCount: number;
};

type UpdateAdminSpecialistInput = {
  session: AdminSession;

  specialistId: BookingSpecialistId;

  displayName: string;

  isActive: boolean;

  googleCalendarId: string;

  calendarLabel: string;

  calendarIsActive: boolean;
};

export type UpdateAdminSpecialistResult = {
  specialistId: BookingSpecialistId;

  displayName: string;

  isActive: boolean;

  calendar: {
    googleCalendarId: string;
    label: string | null;
    isActive: boolean;
  } | null;
};

const isBookingSpecialistId = (value: string): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

const normalizeText = (value: string) => value.trim();

const getActiveBookingCount = async (
  specialistId: BookingSpecialistId,
): Promise<number> => {
  const now = new Date();

  const [result] = await db
    .select({
      count: sql<number>`
            count(*)
          `.mapWith(Number),
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.specialistId, specialistId),

        inArray(bookings.status, ["pending", "confirmed"]),

        sql<boolean>`
            (
              CASE
                WHEN ${bookings.status} = 'confirmed'
                THEN COALESCE(
                  ${bookings.confirmedEndAt},
                  ${bookings.requestedEndAt}
                )
                ELSE ${bookings.requestedEndAt}
              END
            ) >= ${now}
          `,
      ),
    );

  return result?.count ?? 0;
};

const getSpecialistAvailability = async (specialistId: BookingSpecialistId) => {
  const [settings] = await db
    .select({
      minNoticeMinutes: specialistAvailabilitySettings.minNoticeMinutes,

      maxAdvanceDays: specialistAvailabilitySettings.maxAdvanceDays,

      maxBookingsPerDay: specialistAvailabilitySettings.maxBookingsPerDay,
    })
    .from(specialistAvailabilitySettings)
    .where(eq(specialistAvailabilitySettings.specialistId, specialistId))
    .limit(1);

  return settings ?? null;
};

const getSpecialistCalendar = async (specialistId: BookingSpecialistId) => {
  const [calendar] = await db
    .select({
      id: specialistCalendars.id,

      googleCalendarId: specialistCalendars.googleCalendarId,

      label: specialistCalendars.label,

      isActive: specialistCalendars.isActive,
    })
    .from(specialistCalendars)
    .where(eq(specialistCalendars.specialistId, specialistId))
    .limit(1);

  if (!calendar) {
    return null;
  }

  return {
    ...calendar,

    status: calendar.isActive ? ("active" as const) : ("inactive" as const),
  };
};

export const getAdminSpecialists = async (
  session: AdminSession,
): Promise<
  AdminSpecialistListItem[]
> => {
  if (!isOwner(session)) {
    throw new Error("ADMIN_OWNER_ACCESS_REQUIRED");
  }

  const specialistRows = await db
    .select({
      id: specialists.id,

      displayName: specialists.displayName,

      isActive: specialists.isActive,
    })
    .from(specialists);

  const supportedSpecialists = specialistRows.filter(
    (
      specialist,
    ): specialist is {
      id: BookingSpecialistId;
      displayName: string;
      isActive: boolean;
    } => isBookingSpecialistId(specialist.id),
  );

  const result = await Promise.all(
    supportedSpecialists.map(
      async (specialist): Promise<AdminSpecialistListItem> => {
        const [availability, calendar, activeBookingsCount] = await Promise.all(
          [
            getSpecialistAvailability(specialist.id),

            getSpecialistCalendar(specialist.id),

            getActiveBookingCount(specialist.id),
          ],
        );

        return {
          id: specialist.id,

          displayName: specialist.displayName,

          isActive: specialist.isActive,

          availability,

          calendar: calendar
            ? {
                ...calendar,

                status: calendar.status,
              }
            : null,

          activeBookingsCount,
        };
      },
    ),
  );

  return result.sort((first, second) =>
    first.displayName.localeCompare(second.displayName, "pl"),
  );
};

export const updateAdminSpecialist = async ({
  session,
  specialistId,
  displayName,
  isActive,
  googleCalendarId,
  calendarLabel,
  calendarIsActive,
}: UpdateAdminSpecialistInput): Promise<UpdateAdminSpecialistResult> => {
  if (!isOwner(session)) {
    throw new Error("ADMIN_OWNER_ACCESS_REQUIRED");
  }

  const normalizedDisplayName = normalizeText(displayName);

  const normalizedCalendarId = normalizeText(googleCalendarId);

  const normalizedCalendarLabel = normalizeText(calendarLabel);

  if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 80) {
    throw new Error("ADMIN_SPECIALIST_DISPLAY_NAME_INVALID");
  }

  if (normalizedCalendarId.length > 500) {
    throw new Error("ADMIN_SPECIALIST_CALENDAR_ID_INVALID");
  }

  if (normalizedCalendarLabel.length > 100) {
    throw new Error("ADMIN_SPECIALIST_CALENDAR_LABEL_INVALID");
  }

  const [existingSpecialist] = await db
    .select({
      id: specialists.id,
    })
    .from(specialists)
    .where(eq(specialists.id, specialistId))
    .limit(1);

  if (!existingSpecialist) {
    throw new Error("SPECIALIST_NOT_FOUND");
  }

  if (normalizedCalendarId) {
    const [calendarConflict] = await db
      .select({
        id: specialistCalendars.id,

        specialistId: specialistCalendars.specialistId,
      })
      .from(specialistCalendars)
      .where(
        and(
          eq(specialistCalendars.googleCalendarId, normalizedCalendarId),

          ne(specialistCalendars.specialistId, specialistId),
        ),
      )
      .limit(1);

    if (calendarConflict) {
      throw new Error("ADMIN_SPECIALIST_CALENDAR_ALREADY_ASSIGNED");
    }
  }

  return db.transaction(async (tx) => {
    const [updatedSpecialist] = await tx
      .update(specialists)
      .set({
        displayName: normalizedDisplayName,

        isActive,

        updatedAt: new Date(),
      })
      .where(eq(specialists.id, specialistId))
      .returning({
        id: specialists.id,

        displayName: specialists.displayName,

        isActive: specialists.isActive,
      });

    if (!updatedSpecialist) {
      throw new Error("SPECIALIST_NOT_FOUND");
    }

    const [existingCalendar] = await tx
      .select({
        id: specialistCalendars.id,
      })
      .from(specialistCalendars)
      .where(eq(specialistCalendars.specialistId, specialistId))
      .limit(1);

    if (!normalizedCalendarId) {
      if (existingCalendar) {
        await tx
          .delete(specialistCalendars)
          .where(eq(specialistCalendars.id, existingCalendar.id));
      }

      return {
        specialistId,

        displayName: updatedSpecialist.displayName,

        isActive: updatedSpecialist.isActive,

        calendar: null,
      };
    }

    if (existingCalendar) {
      const [updatedCalendar] = await tx
        .update(specialistCalendars)
        .set({
          googleCalendarId: normalizedCalendarId,

          label: normalizedCalendarLabel || null,

          isActive: calendarIsActive,

          updatedAt: new Date(),
        })
        .where(eq(specialistCalendars.id, existingCalendar.id))
        .returning({
          googleCalendarId: specialistCalendars.googleCalendarId,

          label: specialistCalendars.label,

          isActive: specialistCalendars.isActive,
        });

      if (!updatedCalendar) {
        throw new Error("ADMIN_SPECIALIST_CALENDAR_UPDATE_FAILED");
      }

      return {
        specialistId,

        displayName: updatedSpecialist.displayName,

        isActive: updatedSpecialist.isActive,

        calendar: updatedCalendar,
      };
    }

    const [createdCalendar] = await tx
      .insert(specialistCalendars)
      .values({
        specialistId,

        googleCalendarId: normalizedCalendarId,

        label: normalizedCalendarLabel || null,

        isActive: calendarIsActive,
      })
      .returning({
        googleCalendarId: specialistCalendars.googleCalendarId,

        label: specialistCalendars.label,

        isActive: specialistCalendars.isActive,
      });

    if (!createdCalendar) {
      throw new Error("ADMIN_SPECIALIST_CALENDAR_CREATE_FAILED");
    }

    return {
      specialistId,

      displayName: updatedSpecialist.displayName,

      isActive: updatedSpecialist.isActive,

      calendar: createdCalendar,
    };
  });
};
