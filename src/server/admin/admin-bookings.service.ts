import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import { bookingStatusEnum, bookings, specialists } from "@/db/schema";
import type { SpecialistId } from "@/data/specialists";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";

export const adminBookingStatuses = bookingStatusEnum.enumValues;
export type AdminBookingStatus = (typeof adminBookingStatuses)[number];
export type AdminBookingPeriod = "upcoming" | "past";

export type AdminBookingFilters = {
  status?: AdminBookingStatus;
  period?: AdminBookingPeriod;
  specialistId?: SpecialistId;
  customer?: string;
};

const effectiveStart =
  sql<Date>`coalesce(${bookings.confirmedStartAt}, ${bookings.requestedStartAt})`.mapWith(
    bookings.requestedStartAt,
  );
const effectiveEnd =
  sql<Date>`coalesce(${bookings.confirmedEndAt}, ${bookings.requestedEndAt})`.mapWith(
    bookings.requestedEndAt,
  );

export const getAdminBookingScopeCondition = (
  session: AdminSession,
  requestedSpecialistId?: SpecialistId,
) => {
  if (!isOwner(session)) {
    return eq(bookings.specialistId, session.specialistId!);
  }

  return requestedSpecialistId
    ? eq(bookings.specialistId, requestedSpecialistId)
    : undefined;
};

export const getAdminBookings = async (
  session: AdminSession,
  filters: AdminBookingFilters,
) => {
  const now = new Date();
  const customer = filters.customer?.trim().slice(0, 100);

  return db
    .select({
      id: bookings.id,
      status: bookings.status,
      calendarSyncStatus: bookings.calendarSyncStatus,
      startsAt: effectiveStart,
      endsAt: effectiveEnd,
      customerFirstName: bookings.customerFirstName,
      customerLastName: bookings.customerLastName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      massageName: bookings.massageNameSnapshot,
      durationMinutes: bookings.durationMinutesSnapshot,
      durationLabel: bookings.durationLabelSnapshot,
      specialistId: bookings.specialistId,
      specialistName: specialists.displayName,
      locationType: bookings.locationType,
    })
    .from(bookings)
    .innerJoin(specialists, eq(specialists.id, bookings.specialistId))
    .where(
      and(
        getAdminBookingScopeCondition(session, filters.specialistId),
        filters.status ? eq(bookings.status, filters.status) : undefined,
        filters.period === "upcoming" ? gte(effectiveStart, now) : undefined,
        filters.period === "past" ? lt(effectiveStart, now) : undefined,
        customer
          ? or(
              ilike(bookings.customerFirstName, `%${customer}%`),
              ilike(bookings.customerLastName, `%${customer}%`),
              ilike(bookings.customerEmail, `%${customer}%`),
              ilike(bookings.customerPhone, `%${customer}%`),
              ilike(
                sql`${bookings.customerFirstName} || ' ' || ${bookings.customerLastName}`,
                `%${customer}%`,
              ),
            )
          : undefined,
      ),
    )
    .orderBy(
      filters.period === "upcoming"
        ? asc(effectiveStart)
        : desc(effectiveStart),
    );
};

export const getAdminBookingById = async (
  session: AdminSession,
  bookingId: string,
) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bookingId,
    )
  ) {
    return null;
  }

  const [booking] = await db
    .select({
      ...getTableColumns(bookings),
      specialistName: specialists.displayName,
    })
    .from(bookings)
    .innerJoin(specialists, eq(specialists.id, bookings.specialistId))
    .where(
      and(eq(bookings.id, bookingId), getAdminBookingScopeCondition(session)),
    )
    .limit(1);

  return booking ?? null;
};

export const getAdminSpecialistOptions = async () =>
  db
    .select({ id: specialists.id, name: specialists.displayName })
    .from(specialists)
    .orderBy(asc(specialists.displayName));
