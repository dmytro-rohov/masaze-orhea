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
import {
  bookingAddons,
  bookingEvents,
  bookingStatusEnum,
  bookings,
  payments,
  specialists,
} from "@/db/schema";
import type { SpecialistId } from "@/data/specialists";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";

export const adminBookingStatuses = bookingStatusEnum.enumValues;
export type AdminBookingStatus = (typeof adminBookingStatuses)[number];
export type AdminBookingPeriod = "upcoming" | "past";
export type AdminBookingLocationType = "salon" | "mobile";

export type AdminBookingFilters = {
  status?: AdminBookingStatus;
  period?: AdminBookingPeriod;
  specialistId?: SpecialistId;
  customer?: string;
  dateFrom?: Date;
  dateToExclusive?: Date;
  massageId?: string;
  variantId?: string;
  locationType?: AdminBookingLocationType;
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
      source: bookings.source,
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
        filters.dateFrom ? gte(effectiveStart, filters.dateFrom) : undefined,
        filters.dateToExclusive
          ? lt(effectiveStart, filters.dateToExclusive)
          : undefined,
        filters.massageId
          ? eq(bookings.massageId, filters.massageId)
          : undefined,
        filters.variantId
          ? eq(bookings.massageVariantId, filters.variantId)
          : undefined,
        filters.locationType
          ? eq(bookings.locationType, filters.locationType)
          : undefined,
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

  if (!booking) {
    return null;
  }

  const selectedAddons = await db
    .select({
      addonId: bookingAddons.addonId,
      name: bookingAddons.nameSnapshot,
      priceGrosze: bookingAddons.priceGroszeSnapshot,
      treatmentDurationMinutes: bookingAddons.treatmentDurationMinutesSnapshot,
      slotExtensionMinutes: bookingAddons.slotExtensionMinutesSnapshot,
    })
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, booking.id))
    .orderBy(asc(bookingAddons.nameSnapshot));

  const history = await db
    .select({
      id: bookingEvents.id,
      eventType: bookingEvents.eventType,
      fromStatus: bookingEvents.fromStatus,
      toStatus: bookingEvents.toStatus,
      previousStartAt: bookingEvents.previousStartAt,
      previousEndAt: bookingEvents.previousEndAt,
      newStartAt: bookingEvents.newStartAt,
      newEndAt: bookingEvents.newEndAt,
      previousSpecialistId: bookingEvents.previousSpecialistId,
      newSpecialistId: bookingEvents.newSpecialistId,
      actorUsername: bookingEvents.actorUsername,
      actorRole: bookingEvents.actorRole,
      createdAt: bookingEvents.createdAt,
    })
    .from(bookingEvents)
    .where(eq(bookingEvents.bookingId, booking.id))
    .orderBy(desc(bookingEvents.createdAt), desc(bookingEvents.id));

  const [payment] = await db
    .select({
      paidAt: payments.paidAt,
      checkoutSessionId: payments.providerCheckoutSessionId,
      status: payments.status,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.bookingId, booking.id))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return { ...booking, selectedAddons, history, payment: payment ?? null };
};

export const getAdminBookingFilterOptions = async (session: AdminSession) => {
  const scope = getAdminBookingScopeCondition(session);
  const [massageOptions, variantOptions] = await Promise.all([
    db
      .selectDistinct({
        id: bookings.massageId,
        name: bookings.massageNameSnapshot,
      })
      .from(bookings)
      .where(scope)
      .orderBy(asc(bookings.massageNameSnapshot)),
    db
      .selectDistinct({
        id: bookings.massageVariantId,
        massageName: bookings.massageNameSnapshot,
        durationMinutes: bookings.durationMinutesSnapshot,
        durationLabel: bookings.durationLabelSnapshot,
      })
      .from(bookings)
      .where(scope)
      .orderBy(
        asc(bookings.massageNameSnapshot),
        asc(bookings.durationMinutesSnapshot),
        asc(bookings.durationLabelSnapshot),
      ),
  ]);

  return { massageOptions, variantOptions };
};

export const getAdminSpecialistOptions = async () =>
  db
    .select({ id: specialists.id, name: specialists.displayName })
    .from(specialists)
    .orderBy(asc(specialists.displayName));
