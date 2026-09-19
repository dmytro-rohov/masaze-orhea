import { and, eq, inArray, sql } from "drizzle-orm";

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

type AdminSpecialistCalendar = {
  id: string;
  googleCalendarId: string;
  label: string | null;
  isActive: boolean;
  status: AdminSpecialistCalendarStatus;
};

export type AdminSpecialistListItem = {
  id: BookingSpecialistId;

  displayName: string;

  isActive: boolean;

  availability: {
    minNoticeMinutes: number;
    maxAdvanceDays: number;
    maxBookingsPerDay: number | null;
  } | null;

  availabilityCalendar: AdminSpecialistCalendar | null;

  bookingCalendar: AdminSpecialistCalendar | null;

  activeBookingsCount: number;
};

type UpdateAdminSpecialistInput = {
  session: AdminSession;

  specialistId: BookingSpecialistId;

  displayName: string;

  isActive: boolean;

  availabilityCalendarId: string;

  availabilityCalendarLabel: string;

  availabilityCalendarIsActive: boolean;

  bookingCalendarId: string;

  bookingCalendarLabel: string;

  bookingCalendarIsActive: boolean;
};

export type UpdateAdminSpecialistResult = {
  specialistId: BookingSpecialistId;

  displayName: string;

  isActive: boolean;

  availabilityCalendar: {
    googleCalendarId: string;
    label: string | null;
    isActive: boolean;
  } | null;

  bookingCalendar: {
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

const getSpecialistCalendars = async (specialistId: BookingSpecialistId) => {
  const calendars = await db
    .select({
      id: specialistCalendars.id,

      googleCalendarId: specialistCalendars.googleCalendarId,

      label: specialistCalendars.label,

      isActive: specialistCalendars.isActive,

      purpose: specialistCalendars.purpose,
    })
    .from(specialistCalendars)
    .where(eq(specialistCalendars.specialistId, specialistId));

  return Object.fromEntries(
    calendars.map((calendar) => [
      calendar.purpose,
      {
        ...calendar,
        status: calendar.isActive ? ("active" as const) : ("inactive" as const),
      },
    ]),
  ) as Partial<Record<"availability" | "bookings", AdminSpecialistCalendar>>;
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
        const [availability, calendars, activeBookingsCount] = await Promise.all(
          [
            getSpecialistAvailability(specialist.id),

            getSpecialistCalendars(specialist.id),

            getActiveBookingCount(specialist.id),
          ],
        );

        return {
          id: specialist.id,

          displayName: specialist.displayName,

          isActive: specialist.isActive,

          availability,

          availabilityCalendar: calendars.availability ?? null,

          bookingCalendar: calendars.bookings ?? null,

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
  availabilityCalendarId,
  availabilityCalendarLabel,
  availabilityCalendarIsActive,
  bookingCalendarId,
  bookingCalendarLabel,
  bookingCalendarIsActive,
}: UpdateAdminSpecialistInput): Promise<UpdateAdminSpecialistResult> => {
  if (!isOwner(session)) {
    throw new Error("ADMIN_OWNER_ACCESS_REQUIRED");
  }

  const normalizedDisplayName = normalizeText(displayName);

  const calendarInputs = [
    {
      purpose: "availability" as const,
      googleCalendarId: normalizeText(availabilityCalendarId),
      label: normalizeText(availabilityCalendarLabel),
      isActive: availabilityCalendarIsActive,
    },
    {
      purpose: "bookings" as const,
      googleCalendarId: normalizeText(bookingCalendarId),
      label: normalizeText(bookingCalendarLabel),
      isActive: bookingCalendarIsActive,
    },
  ];

  if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 80) {
    throw new Error("ADMIN_SPECIALIST_DISPLAY_NAME_INVALID");
  }

  if (calendarInputs.some((calendar) => calendar.googleCalendarId.length > 500)) {
    throw new Error("ADMIN_SPECIALIST_CALENDAR_ID_INVALID");
  }

  if (calendarInputs.some((calendar) => calendar.label.length > 100)) {
    throw new Error("ADMIN_SPECIALIST_CALENDAR_LABEL_INVALID");
  }

  if (
    calendarInputs[0].googleCalendarId &&
    calendarInputs[0].googleCalendarId === calendarInputs[1].googleCalendarId
  ) {
    throw new Error("ADMIN_SPECIALIST_CALENDAR_ALREADY_ASSIGNED");
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

  for (const calendarInput of calendarInputs) {
    if (!calendarInput.googleCalendarId) {
      continue;
    }

    const [calendarConflict] = await db
      .select({
        id: specialistCalendars.id,

        specialistId: specialistCalendars.specialistId,

        purpose: specialistCalendars.purpose,
      })
      .from(specialistCalendars)
      .where(
        eq(
          specialistCalendars.googleCalendarId,
          calendarInput.googleCalendarId,
        ),
      )
      .limit(1);

    if (
      calendarConflict &&
      (calendarConflict.specialistId !== specialistId ||
        calendarConflict.purpose !== calendarInput.purpose)
    ) {
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

    const savedCalendars: Array<
      readonly [
        "availability" | "bookings",
        UpdateAdminSpecialistResult["availabilityCalendar"],
      ]
    > = [];

    for (const calendarInput of calendarInputs) {
      const [existingCalendar] = await tx
        .select({ id: specialistCalendars.id })
        .from(specialistCalendars)
        .where(
          and(
            eq(specialistCalendars.specialistId, specialistId),
            eq(specialistCalendars.purpose, calendarInput.purpose),
          ),
        )
        .limit(1);

      if (!calendarInput.googleCalendarId) {
        if (existingCalendar) {
          await tx
            .delete(specialistCalendars)
            .where(eq(specialistCalendars.id, existingCalendar.id));
        }

        savedCalendars.push([calendarInput.purpose, null]);

        continue;
      }

      const values = {
        googleCalendarId: calendarInput.googleCalendarId,
        label: calendarInput.label || null,
        isActive: calendarInput.isActive,
        updatedAt: new Date(),
      };

      const [savedCalendar] = existingCalendar
        ? await tx
            .update(specialistCalendars)
            .set(values)
            .where(eq(specialistCalendars.id, existingCalendar.id))
            .returning({
              googleCalendarId: specialistCalendars.googleCalendarId,
              label: specialistCalendars.label,
              isActive: specialistCalendars.isActive,
            })
        : await tx
            .insert(specialistCalendars)
            .values({
              specialistId,
              purpose: calendarInput.purpose,
              ...values,
            })
            .returning({
              googleCalendarId: specialistCalendars.googleCalendarId,
              label: specialistCalendars.label,
              isActive: specialistCalendars.isActive,
            });

      if (!savedCalendar) {
        throw new Error("ADMIN_SPECIALIST_CALENDAR_UPDATE_FAILED");
      }

      savedCalendars.push([calendarInput.purpose, savedCalendar]);
    }

    const calendars = Object.fromEntries(savedCalendars) as Record<
      "availability" | "bookings",
      UpdateAdminSpecialistResult["availabilityCalendar"]
    >;

    return {
      specialistId,

      displayName: updatedSpecialist.displayName,

      isActive: updatedSpecialist.isActive,

      availabilityCalendar: calendars.availability,

      bookingCalendar: calendars.bookings,
    };
  });
};
