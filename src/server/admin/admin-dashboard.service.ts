import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookings, voucherOrders, vouchers } from "@/db/schema";

const activeBookingStatuses = ["pending", "confirmed"] as const;
const effectiveBookingStart = sql<Date>`coalesce(${bookings.confirmedStartAt}, ${bookings.requestedStartAt})`;

export type AdminDashboardData = Awaited<
  ReturnType<typeof getAdminDashboardData>
>;

export const getAdminDashboardData = async () => {
  const now = new Date();

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
        ),
      ),
    db
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, activeBookingStatuses),
          sql`(${effectiveBookingStart} AT TIME ZONE 'Europe/Warsaw')::date = (now() AT TIME ZONE 'Europe/Warsaw')::date`,
        ),
      ),
    db
      .select({ value: count() })
      .from(voucherOrders)
      .where(eq(voucherOrders.status, "paid")),
    db
      .select({ value: count() })
      .from(bookings)
      .where(eq(bookings.calendarSyncStatus, "failed")),
    db
      .select({ value: count() })
      .from(vouchers)
      .where(eq(vouchers.emailDeliveryStatus, "failed")),
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
        ),
      )
      .orderBy(asc(effectiveBookingStart))
      .limit(5),
    db
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
      .limit(5),
  ]);

  return {
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
