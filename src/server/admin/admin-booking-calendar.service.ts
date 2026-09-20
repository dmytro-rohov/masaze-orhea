import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookings, specialists } from "@/db/schema";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { getAdminBookingScopeCondition } from "@/server/admin/admin-bookings.service";
import {
  addBookingCalendarDays,
  createBookingDateTime,
  getBookingZonedDateTime,
  isValidBookingDate,
} from "@/server/bookings/booking-time-zone";

const activeBookingStatuses = ["pending", "confirmed"] as const;
type AdminCalendarBookingStatus = (typeof activeBookingStatuses)[number];
const weekdayIndexes = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
} as const;

const effectiveStart = sql<Date>`case
  when ${bookings.status} = 'confirmed'
    then coalesce(${bookings.confirmedStartAt}, ${bookings.requestedStartAt})
  else ${bookings.requestedStartAt}
end`.mapWith(bookings.requestedStartAt);

const effectiveEnd = sql<Date>`case
  when ${bookings.status} = 'confirmed'
    then coalesce(${bookings.confirmedEndAt}, ${bookings.requestedEndAt})
  else ${bookings.requestedEndAt}
end`.mapWith(bookings.requestedEndAt);

const normalizeWeekStart = (dateKey: string) => {
  const localDate = getBookingZonedDateTime(
    createBookingDateTime(dateKey, 12 * 60 * 60),
  );

  return addBookingCalendarDays(
    dateKey,
    -weekdayIndexes[localDate.weekday],
  );
};

export type AdminCalendarRange = ReturnType<typeof resolveAdminCalendarRange>;

export type AdminCalendarBooking = {
  id: string;
  status: AdminCalendarBookingStatus;
  startsAt: Date;
  endsAt: Date;
  customerFirstName: string;
  customerLastName: string;
  massageName: string;
  specialistId: string;
  specialistName: string;
};

export const resolveAdminCalendarRange = ({
  week,
  day,
  now = new Date(),
}: {
  week?: string | null;
  day?: string | null;
  now?: Date;
}) => {
  const todayDateKey = getBookingZonedDateTime(now).dateKey;
  const requestedDay = day && isValidBookingDate(day) ? day : null;
  const requestedWeek = week && isValidBookingDate(week) ? week : null;
  const anchorDateKey = requestedDay ?? requestedWeek ?? todayDateKey;
  const weekStartDateKey = normalizeWeekStart(anchorDateKey);
  const weekEndDateKey = addBookingCalendarDays(weekStartDateKey, 6);
  const rangeEndDateKey = addBookingCalendarDays(weekStartDateKey, 7);
  const todayIsInWeek =
    todayDateKey >= weekStartDateKey && todayDateKey <= weekEndDateKey;
  const selectedDayDateKey =
    requestedDay ?? (todayIsInWeek ? todayDateKey : weekStartDateKey);

  return {
    todayDateKey,
    weekStartDateKey,
    weekEndDateKey,
    selectedDayDateKey,
    previousWeekDateKey: addBookingCalendarDays(weekStartDateKey, -7),
    nextWeekDateKey: addBookingCalendarDays(weekStartDateKey, 7),
    previousDayDateKey: addBookingCalendarDays(selectedDayDateKey, -1),
    nextDayDateKey: addBookingCalendarDays(selectedDayDateKey, 1),
    dayDateKeys: Array.from({ length: 7 }, (_, index) =>
      addBookingCalendarDays(weekStartDateKey, index),
    ),
    rangeStart: createBookingDateTime(weekStartDateKey, 0),
    rangeEnd: createBookingDateTime(rangeEndDateKey, 0),
  };
};

export const getAdminCalendarBookings = async (
  session: AdminSession,
  rangeStart: Date,
  rangeEnd: Date,
) => {
  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      startsAt: effectiveStart,
      endsAt: effectiveEnd,
      customerFirstName: bookings.customerFirstName,
      customerLastName: bookings.customerLastName,
      massageName: bookings.massageNameSnapshot,
      specialistId: bookings.specialistId,
      specialistName: specialists.displayName,
    })
    .from(bookings)
    .innerJoin(specialists, eq(specialists.id, bookings.specialistId))
    .where(
      and(
        inArray(bookings.status, activeBookingStatuses),
        lt(effectiveStart, rangeEnd),
        gt(effectiveEnd, rangeStart),
        getAdminBookingScopeCondition(session),
      ),
    )
    .orderBy(asc(effectiveStart), asc(effectiveEnd), asc(bookings.id));

  return rows as AdminCalendarBooking[];
};
