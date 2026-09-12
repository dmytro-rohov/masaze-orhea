import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookings, voucherOrders, vouchers } from "@/db/schema";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";

const activeBookingStatuses = ["pending", "confirmed"] as const;
const effectiveBookingStart =
  sql<Date>`coalesce(${bookings.confirmedStartAt}, ${bookings.requestedStartAt})`.mapWith(
    bookings.requestedStartAt,
  );

export type AdminDashboardData = Awaited<
  ReturnType<typeof getAdminDashboardData>
>;

export const getAdminDashboardData = async (session: AdminSession) => {
  const now = new Date();
  const specialistScope = isOwner(session)
    ? undefined
    : eq(bookings.specialistId, session.specialistId!);

  const [
    [upcomingBookings],
    [bookingsToday],
    [paidVoucherOrders],
    [failedCalendarSyncs],
    [failedVoucherEmails],
    nearestBookings,
    recentVoucherPurchases,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, activeBookingStatuses),
          gte(effectiveBookingStart, now),
          specialistScope,
        ),
      ),
    db
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, activeBookingStatuses),
          sql`(${effectiveBookingStart} AT TIME ZONE 'Europe/Warsaw')::date = (now() AT TIME ZONE 'Europe/Warsaw')::date`,
          specialistScope,
        ),
      ),
    isOwner(session)
      ? db
          .select({ value: count() })
          .from(voucherOrders)
          .where(eq(voucherOrders.status, "paid"))
      : Promise.resolve([{ value: 0 }]),
    db
      .select({ value: count() })
      .from(bookings)
      .where(and(eq(bookings.calendarSyncStatus, "failed"), specialistScope)),
    isOwner(session)
      ? db
          .select({ value: count() })
          .from(vouchers)
          .where(eq(vouchers.emailDeliveryStatus, "failed"))
      : Promise.resolve([{ value: 0 }]),
    db
      .select({
        id: bookings.id,
        status: bookings.status,
        startsAt: effectiveBookingStart,
        customerFirstName: bookings.customerFirstName,
        customerLastName: bookings.customerLastName,
        massageName: bookings.massageNameSnapshot,
        specialistId: bookings.specialistId,
        locationType: bookings.locationType,
      })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, activeBookingStatuses),
          gte(effectiveBookingStart, now),
          specialistScope,
        ),
      )
      .orderBy(asc(effectiveBookingStart))
      .limit(5),
    isOwner(session)
      ? db
          .select({
            id: voucherOrders.id,
            status: voucherOrders.status,
            createdAt: voucherOrders.createdAt,
            buyerFirstName: voucherOrders.buyerFirstName,
            buyerLastName: voucherOrders.buyerLastName,
            recipientName: voucherOrders.recipientName,
            massageName: voucherOrders.massageNameSnapshot,
            amountGrosze: voucherOrders.amountGrosze,
            currency: voucherOrders.currency,
            voucherCode: vouchers.code,
            emailDeliveryStatus: vouchers.emailDeliveryStatus,
          })
          .from(voucherOrders)
          .leftJoin(vouchers, eq(vouchers.voucherOrderId, voucherOrders.id))
          .where(eq(voucherOrders.status, "paid"))
          .orderBy(desc(voucherOrders.createdAt))
          .limit(5)
      : Promise.resolve([]),
  ]);

  return {
    canViewVoucherMetrics: isOwner(session),
    summary: {
      upcomingBookings: upcomingBookings?.value ?? 0,
      bookingsToday: bookingsToday?.value ?? 0,
      paidVoucherOrders: paidVoucherOrders?.value ?? 0,
      failedCalendarSyncs: failedCalendarSyncs?.value ?? 0,
      failedVoucherEmails: failedVoucherEmails?.value ?? 0,
    },
    nearestBookings,
    recentVoucherPurchases,
  };
};
