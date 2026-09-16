import { and, asc, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  bookings,
  payments,
  specialists,
  voucherOrders,
  vouchers,
} from "@/db/schema";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import {
  getBookingDayRange,
  isValidBookingDate,
} from "@/server/bookings/booking-time-zone";
import type { BookingSpecialistId } from "@/server/bookings/booking.types";

const MAX_REPORT_RANGE_DAYS = 366;
const MILLISECONDS_PER_DAY = 86_400_000;

const effectiveBookingStart =
  sql<Date>`coalesce(${bookings.confirmedStartAt}, ${bookings.requestedStartAt})`.mapWith(
    bookings.requestedStartAt,
  );
const effectiveBookingEnd =
  sql<Date>`coalesce(${bookings.confirmedEndAt}, ${bookings.requestedEndAt})`.mapWith(
    bookings.requestedEndAt,
  );
const latestPaymentStatus = sql<
  (typeof payments.$inferSelect)["status"] | null
>`(
  select p.status
  from payments p
  where p.voucher_order_id = ${voucherOrders.id}
  order by p.created_at desc, p.id desc
  limit 1
)`;

export type AdminReportDateRange = {
  from: string;
  to: string;
};

export type AdminReportBookingRow = {
  bookingId: string;
  appointmentStartAt: Date;
  appointmentEndAt: Date;
  specialistId: BookingSpecialistId;
  specialistName: string;
  massageName: string;
  variant: string;
  durationMinutes: number | null;
  status: (typeof bookings.$inferSelect)["status"];
  locationType: (typeof bookings.$inferSelect)["locationType"];
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  priceGrosze: number;
  createdAt: Date;
};

export type AdminReportVoucherRow = {
  orderId: string;
  purchasedAt: Date;
  voucherCode: string | null;
  voucherType: (typeof voucherOrders.$inferSelect)["voucherType"];
  massageName: string | null;
  variant: string;
  amountGrosze: number;
  currency: string;
  orderStatus: (typeof voucherOrders.$inferSelect)["status"];
  paymentStatus: (typeof payments.$inferSelect)["status"] | null;
  voucherStatus: (typeof vouchers.$inferSelect)["status"] | null;
  redeemedAt: Date | null;
  recipientName: string;
  buyerName: string;
  buyerEmail: string;
  createdAt: Date;
};

export type AdminReportSummary = {
  bookingsTotal: number;
  bookingsByStatus: Record<
    (typeof bookings.$inferSelect)["status"],
    number
  >;
  bookingsBySpecialist: Record<BookingSpecialistId, number>;
  soldVouchers: number;
  redeemedVouchers: number;
  soldVoucherValueGrosze: number;
  currency: "PLN";
};

export type AdminReportDto = {
  scope:
    | { type: "owner" }
    | { type: "specialist"; specialistId: BookingSpecialistId };
  dateRange: AdminReportDateRange;
  generatedAt: Date;
  bookings: Record<BookingSpecialistId, AdminReportBookingRow[]>;
  vouchers: AdminReportVoucherRow[] | null;
  summary: AdminReportSummary | null;
};

export const validateAdminReportDateRange = (
  dateFrom: string,
  dateTo: string,
): AdminReportDateRange => {
  if (!isValidBookingDate(dateFrom) || !isValidBookingDate(dateTo)) {
    throw new Error("ADMIN_REPORT_DATE_INVALID");
  }

  const start = getBookingDayRange(dateFrom).start;
  const end = getBookingDayRange(dateTo).end;

  if (start >= end) {
    throw new Error("ADMIN_REPORT_DATE_RANGE_INVALID");
  }

  const rangeDays = Math.round(
    (Date.parse(`${dateTo}T00:00:00Z`) -
      Date.parse(`${dateFrom}T00:00:00Z`)) /
      MILLISECONDS_PER_DAY,
  );

  if (rangeDays >= MAX_REPORT_RANGE_DAYS) {
    throw new Error("ADMIN_REPORT_DATE_RANGE_TOO_LONG");
  }

  return { from: dateFrom, to: dateTo };
};

const getVariantLabel = ({
  durationLabel,
  durationMinutes,
}: {
  durationLabel: string | null;
  durationMinutes: number | null;
}): string =>
  durationLabel ?? (durationMinutes ? `${durationMinutes} min` : "—");

const createEmptyStatusSummary = (): AdminReportSummary["bookingsByStatus"] => ({
  pending: 0,
  confirmed: 0,
  cancelled: 0,
  completed: 0,
  rejected: 0,
  no_show: 0,
});

export const getAdminReport = async (
  session: AdminSession,
  dateFrom: string,
  dateTo: string,
): Promise<AdminReportDto> => {
  const dateRange = validateAdminReportDateRange(dateFrom, dateTo);
  const startAt = getBookingDayRange(dateRange.from).start;
  const endAt = getBookingDayRange(dateRange.to).end;
  const owner = isOwner(session);

  if (!owner && !session.specialistId) {
    throw new Error("ADMIN_SPECIALIST_SCOPE_INVALID");
  }

  const specialistScope = owner
    ? undefined
    : eq(bookings.specialistId, session.specialistId!);

  const bookingRows = await db
    .select({
      bookingId: bookings.id,
      appointmentStartAt: effectiveBookingStart,
      appointmentEndAt: effectiveBookingEnd,
      specialistId: bookings.specialistId,
      specialistName: specialists.displayName,
      massageName: bookings.massageNameSnapshot,
      durationLabel: bookings.durationLabelSnapshot,
      durationMinutes: bookings.durationMinutesSnapshot,
      status: bookings.status,
      locationType: bookings.locationType,
      customerFirstName: bookings.customerFirstName,
      customerLastName: bookings.customerLastName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      priceGrosze: bookings.priceGroszeSnapshot,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(specialists, eq(specialists.id, bookings.specialistId))
    .where(
      and(
        gte(effectiveBookingStart, startAt),
        lt(effectiveBookingStart, endAt),
        specialistScope,
      ),
    )
    .orderBy(asc(effectiveBookingStart), asc(bookings.id));

  const reportBookings: AdminReportDto["bookings"] = {
    adrian: [],
    aleksandra: [],
  };

  for (const row of bookingRows) {
    if (row.specialistId !== "adrian" && row.specialistId !== "aleksandra") {
      continue;
    }

    reportBookings[row.specialistId].push({
      bookingId: row.bookingId,
      appointmentStartAt: row.appointmentStartAt,
      appointmentEndAt: row.appointmentEndAt,
      specialistId: row.specialistId,
      specialistName: row.specialistName,
      massageName: row.massageName,
      variant: getVariantLabel(row),
      durationMinutes: row.durationMinutes,
      status: row.status,
      locationType: row.locationType,
      customerName: `${row.customerFirstName} ${row.customerLastName}`.trim(),
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      priceGrosze: row.priceGrosze,
      createdAt: row.createdAt,
    });
  }

  if (!owner) {
    return {
      scope: {
        type: "specialist",
        specialistId: session.specialistId!,
      },
      dateRange,
      generatedAt: new Date(),
      bookings: reportBookings,
      vouchers: null,
      summary: null,
    };
  }

  const voucherRows = await db
    .select({
      orderId: voucherOrders.id,
      purchasedAt: voucherOrders.createdAt,
      voucherCode: vouchers.code,
      voucherType: voucherOrders.voucherType,
      massageName: voucherOrders.massageNameSnapshot,
      durationLabel: voucherOrders.durationLabelSnapshot,
      durationMinutes: voucherOrders.durationMinutesSnapshot,
      amountGrosze: voucherOrders.amountGrosze,
      currency: voucherOrders.currency,
      orderStatus: voucherOrders.status,
      paymentStatus: latestPaymentStatus,
      voucherStatus: vouchers.status,
      redeemedAt: vouchers.redeemedAt,
      recipientName: voucherOrders.recipientName,
      buyerFirstName: voucherOrders.buyerFirstName,
      buyerLastName: voucherOrders.buyerLastName,
      buyerEmail: voucherOrders.buyerEmail,
      createdAt: voucherOrders.createdAt,
    })
    .from(voucherOrders)
    .leftJoin(vouchers, eq(vouchers.voucherOrderId, voucherOrders.id))
    .where(
      and(
        gte(voucherOrders.createdAt, startAt),
        lt(voucherOrders.createdAt, endAt),
      ),
    )
    .orderBy(asc(voucherOrders.createdAt), asc(voucherOrders.id));

  const reportVouchers: AdminReportVoucherRow[] = voucherRows.map((row) => ({
    orderId: row.orderId,
    purchasedAt: row.purchasedAt,
    voucherCode: row.voucherCode,
    voucherType: row.voucherType,
    massageName: row.massageName,
    variant: getVariantLabel(row),
    amountGrosze: row.amountGrosze,
    currency: row.currency,
    orderStatus: row.orderStatus,
    paymentStatus: row.paymentStatus,
    voucherStatus: row.voucherStatus,
    redeemedAt: row.redeemedAt,
    recipientName: row.recipientName ?? "Nie podano",
    buyerName: `${row.buyerFirstName} ${row.buyerLastName}`.trim(),
    buyerEmail: row.buyerEmail,
    createdAt: row.createdAt,
  }));

  const allBookings = [
    ...reportBookings.adrian,
    ...reportBookings.aleksandra,
  ];
  const bookingsByStatus = createEmptyStatusSummary();

  for (const booking of allBookings) {
    bookingsByStatus[booking.status] += 1;
  }

  const soldVouchers = reportVouchers.filter(
    (voucher) => voucher.orderStatus === "paid",
  );

  return {
    scope: { type: "owner" },
    dateRange,
    generatedAt: new Date(),
    bookings: reportBookings,
    vouchers: reportVouchers,
    summary: {
      bookingsTotal: allBookings.length,
      bookingsByStatus,
      bookingsBySpecialist: {
        adrian: reportBookings.adrian.length,
        aleksandra: reportBookings.aleksandra.length,
      },
      soldVouchers: soldVouchers.length,
      redeemedVouchers: soldVouchers.filter(
        (voucher) => voucher.voucherStatus === "redeemed",
      ).length,
      soldVoucherValueGrosze: soldVouchers.reduce(
        (sum, voucher) =>
          voucher.currency === "PLN" ? sum + voucher.amountGrosze : sum,
        0,
      ),
      currency: "PLN",
    },
  };
};
