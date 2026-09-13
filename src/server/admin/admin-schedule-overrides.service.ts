import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { specialistAvailabilityOverrides, specialists } from "@/db/schema";

import type { AdminSession } from "./admin-auth.service";
import { isOwner } from "./admin-authorization.service";

import {
  addBookingCalendarDays,
  isValidBookingDate,
} from "../bookings/booking-time-zone";

import type { BookingSpecialistId } from "../bookings/booking.types";

import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "../calendar/google-calendar.service";

import { getSpecialistCalendarId } from "../calendar/specialist-calendar.service";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type AdminScheduleOverrideType = "unavailable" | "custom";

type SaveAdminScheduleOverrideInput = {
  session: AdminSession;
  specialistId: BookingSpecialistId;
  overrideId?: string;
  date: string;
  type: AdminScheduleOverrideType;
  startTime?: string;
  endTime?: string;
};

type DeleteAdminScheduleOverrideInput = {
  session: AdminSession;
  overrideId: string;
};

export type AdminScheduleOverrideMutationResult = {
  id: string;
  date: string;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  googleSyncSucceeded: boolean;
};

export type AdminScheduleOverrideDeleteResult = {
  id: string;
  googleSyncSucceeded: boolean;
};

const isBookingSpecialistId = (value: unknown): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

const resolveSpecialistId = (
  session: AdminSession,
  requestedSpecialistId: BookingSpecialistId,
): BookingSpecialistId => {
  if (isOwner(session)) {
    return requestedSpecialistId;
  }

  if (!session.specialistId) {
    throw new Error("ADMIN_SPECIALIST_SCOPE_INVALID");
  }

  if (session.specialistId !== requestedSpecialistId) {
    throw new Error("ADMIN_SPECIALIST_SCOPE_FORBIDDEN");
  }

  return session.specialistId;
};

const validateCustomTimes = (startTime?: string, endTime?: string) => {
  if (
    !startTime ||
    !endTime ||
    !timePattern.test(startTime) ||
    !timePattern.test(endTime)
  ) {
    throw new Error("ADMIN_SCHEDULE_OVERRIDE_INVALID_TIME");
  }

  if (startTime >= endTime) {
    throw new Error("ADMIN_SCHEDULE_OVERRIDE_INVALID_TIME_RANGE");
  }

  return {
    startTime: `${startTime}:00`,
    endTime: `${endTime}:00`,
  };
};

const getOverrideGoogleEventId = (overrideId: string): string => {
  const normalized = overrideId.replaceAll("-", "").toLowerCase();

  return `orheaoff${normalized}`;
};

const getGoogleDayOffEvent = ({
  eventId,
  date,
}: {
  eventId: string;
  date: string;
}) => ({
  id: eventId,

  summary: "ORHEA — Dzień wolny",

  description: "Dzień wolny ustawiony w panelu administracyjnym ORHEA.",

  start: {
    date,
  },

  end: {
    date: addBookingCalendarDays(date, 1),
  },

  transparency: "opaque" as const,
});

const syncDayOffToGoogle = async ({
  specialistId,
  overrideId,
  date,
}: {
  specialistId: BookingSpecialistId;
  overrideId: string;
  date: string;
}): Promise<boolean> => {
  try {
    const calendarId = await getSpecialistCalendarId(specialistId);

    const eventId = getOverrideGoogleEventId(overrideId);

    const event = getGoogleDayOffEvent({
      eventId,
      date,
    });

    try {
      await getGoogleCalendarEvent({
        calendarId,
        eventId,
      });

      await updateGoogleCalendarEvent({
        calendarId,
        eventId,

        updates: {
          summary: event.summary,

          description: event.description,

          start: event.start,

          end: event.end,

          transparency: event.transparency,
        },
      });

      return true;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "GOOGLE_CALENDAR_EVENT_NOT_FOUND"
      ) {
        throw error;
      }

      await createGoogleCalendarEvent({
        calendarId,
        event,
      });

      return true;
    }
  } catch (error) {
    console.error("Admin schedule day-off Google sync failed:", {
      specialistId,
      overrideId,
      date,
      error,
    });

    return false;
  }
};

const removeDayOffFromGoogle = async ({
  specialistId,
  overrideId,
}: {
  specialistId: BookingSpecialistId;
  overrideId: string;
}): Promise<boolean> => {
  try {
    const calendarId = await getSpecialistCalendarId(specialistId);

    const eventId = getOverrideGoogleEventId(overrideId);

    try {
      await deleteGoogleCalendarEvent({
        calendarId,
        eventId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "GOOGLE_CALENDAR_EVENT_NOT_FOUND"
      ) {
        return true;
      }

      throw error;
    }

    return true;
  } catch (error) {
    console.error("Admin schedule day-off Google cleanup failed:", {
      specialistId,
      overrideId,
      error,
    });

    return false;
  }
};

export const saveAdminScheduleOverride = async ({
  session,
  specialistId,
  overrideId,
  date,
  type,
  startTime,
  endTime,
}: SaveAdminScheduleOverrideInput): Promise<AdminScheduleOverrideMutationResult> => {
  if (!isBookingSpecialistId(specialistId)) {
    throw new Error("ADMIN_SPECIALIST_INVALID");
  }

  if (!isValidBookingDate(date)) {
    throw new Error("ADMIN_SCHEDULE_OVERRIDE_INVALID_DATE");
  }

  if (overrideId && !uuidPattern.test(overrideId)) {
    throw new Error("ADMIN_SCHEDULE_OVERRIDE_INVALID_ID");
  }

  const effectiveSpecialistId = resolveSpecialistId(session, specialistId);

  const [specialist] = await db
    .select({
      id: specialists.id,
    })
    .from(specialists)
    .where(eq(specialists.id, effectiveSpecialistId))
    .limit(1);

  if (!specialist) {
    throw new Error("SPECIALIST_NOT_FOUND");
  }

  const normalized =
    type === "custom"
      ? validateCustomTimes(startTime, endTime)
      : {
          startTime: null,
          endTime: null,
        };

  const saved = await db.transaction(async (tx) => {
    if (overrideId) {
      const [existing] = await tx
        .select({
          id: specialistAvailabilityOverrides.id,

          specialistId: specialistAvailabilityOverrides.specialistId,

          isAvailable: specialistAvailabilityOverrides.isAvailable,
        })
        .from(specialistAvailabilityOverrides)
        .where(eq(specialistAvailabilityOverrides.id, overrideId))
        .limit(1);

      if (!existing) {
        throw new Error("ADMIN_SCHEDULE_OVERRIDE_NOT_FOUND");
      }

      if (existing.specialistId !== effectiveSpecialistId) {
        throw new Error("ADMIN_SPECIALIST_SCOPE_FORBIDDEN");
      }

      await tx.delete(specialistAvailabilityOverrides).where(
        and(
          eq(
            specialistAvailabilityOverrides.specialistId,
            effectiveSpecialistId,
          ),

          eq(specialistAvailabilityOverrides.date, date),

          ne(specialistAvailabilityOverrides.id, overrideId),
        ),
      );

      const [updated] = await tx
        .update(specialistAvailabilityOverrides)
        .set({
          date,

          isAvailable: type === "custom",

          startTime: normalized.startTime,

          endTime: normalized.endTime,

          updatedAt: new Date(),
        })
        .where(eq(specialistAvailabilityOverrides.id, overrideId))
        .returning({
          id: specialistAvailabilityOverrides.id,

          date: specialistAvailabilityOverrides.date,

          isAvailable: specialistAvailabilityOverrides.isAvailable,

          startTime: specialistAvailabilityOverrides.startTime,

          endTime: specialistAvailabilityOverrides.endTime,
        });

      if (!updated) {
        throw new Error("ADMIN_SCHEDULE_OVERRIDE_NOT_FOUND");
      }

      return {
        override: updated,

        wasPreviouslyUnavailable: !existing.isAvailable,
      };
    }

    const [existingForDate] = await tx
      .select({
        id: specialistAvailabilityOverrides.id,

        isAvailable: specialistAvailabilityOverrides.isAvailable,
      })
      .from(specialistAvailabilityOverrides)
      .where(
        and(
          eq(
            specialistAvailabilityOverrides.specialistId,
            effectiveSpecialistId,
          ),

          eq(specialistAvailabilityOverrides.date, date),
        ),
      )
      .limit(1);

    if (existingForDate) {
      const [updated] = await tx
        .update(specialistAvailabilityOverrides)
        .set({
          isAvailable: type === "custom",

          startTime: normalized.startTime,

          endTime: normalized.endTime,

          updatedAt: new Date(),
        })
        .where(eq(specialistAvailabilityOverrides.id, existingForDate.id))
        .returning({
          id: specialistAvailabilityOverrides.id,

          date: specialistAvailabilityOverrides.date,

          isAvailable: specialistAvailabilityOverrides.isAvailable,

          startTime: specialistAvailabilityOverrides.startTime,

          endTime: specialistAvailabilityOverrides.endTime,
        });

      if (!updated) {
        throw new Error("ADMIN_SCHEDULE_OVERRIDE_NOT_FOUND");
      }

      return {
        override: updated,

        wasPreviouslyUnavailable: !existingForDate.isAvailable,
      };
    }

    const [created] = await tx
      .insert(specialistAvailabilityOverrides)
      .values({
        specialistId: effectiveSpecialistId,

        date,

        isAvailable: type === "custom",

        startTime: normalized.startTime,

        endTime: normalized.endTime,
      })
      .returning({
        id: specialistAvailabilityOverrides.id,

        date: specialistAvailabilityOverrides.date,

        isAvailable: specialistAvailabilityOverrides.isAvailable,

        startTime: specialistAvailabilityOverrides.startTime,

        endTime: specialistAvailabilityOverrides.endTime,
      });

    if (!created) {
      throw new Error("ADMIN_SCHEDULE_OVERRIDE_CREATE_FAILED");
    }

    return {
      override: created,

      wasPreviouslyUnavailable: false,
    };
  });

  let googleSyncSucceeded = true;

  if (type === "unavailable") {
    googleSyncSucceeded = await syncDayOffToGoogle({
      specialistId: effectiveSpecialistId,

      overrideId: saved.override.id,

      date: saved.override.date,
    });
  } else if (saved.wasPreviouslyUnavailable) {
    googleSyncSucceeded = await removeDayOffFromGoogle({
      specialistId: effectiveSpecialistId,

      overrideId: saved.override.id,
    });
  }

  return {
    ...saved.override,
    googleSyncSucceeded,
  };
};

export const deleteAdminScheduleOverride = async ({
  session,
  overrideId,
}: DeleteAdminScheduleOverrideInput): Promise<AdminScheduleOverrideDeleteResult> => {
  if (!uuidPattern.test(overrideId)) {
    throw new Error("ADMIN_SCHEDULE_OVERRIDE_INVALID_ID");
  }

  const [override] = await db
    .select({
      id: specialistAvailabilityOverrides.id,

      specialistId: specialistAvailabilityOverrides.specialistId,

      isAvailable: specialistAvailabilityOverrides.isAvailable,
    })
    .from(specialistAvailabilityOverrides)
    .where(eq(specialistAvailabilityOverrides.id, overrideId))
    .limit(1);

  if (!override) {
    throw new Error("ADMIN_SCHEDULE_OVERRIDE_NOT_FOUND");
  }

  if (!isOwner(session) && session.specialistId !== override.specialistId) {
    throw new Error("ADMIN_SPECIALIST_SCOPE_FORBIDDEN");
  }

  await db
    .delete(specialistAvailabilityOverrides)
    .where(eq(specialistAvailabilityOverrides.id, overrideId));

  let googleSyncSucceeded = true;

  if (!override.isAvailable) {
    googleSyncSucceeded = await removeDayOffFromGoogle({
      specialistId: override.specialistId as BookingSpecialistId,

      overrideId,
    });
  }

  return {
    id: overrideId,

    googleSyncSucceeded,
  };
};
