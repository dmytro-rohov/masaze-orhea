import { and, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  paymentStatusEnum,
  payments,
  voucherEmailDeliveryStatusEnum,
  voucherOrders,
  voucherOrderStatusEnum,
  vouchers,
  voucherStatusEnum,
} from "@/db/schema";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";

export const adminVoucherOrderStatuses = voucherOrderStatusEnum.enumValues;
export const adminPaymentStatuses = paymentStatusEnum.enumValues;
export const adminVoucherStatuses = voucherStatusEnum.enumValues;
export const adminVoucherEmailDeliveryStatuses =
  voucherEmailDeliveryStatusEnum.enumValues;

export type AdminVoucherOrderStatus =
  (typeof adminVoucherOrderStatuses)[number];
export type AdminPaymentStatus = (typeof adminPaymentStatuses)[number];
export type AdminVoucherStatus = (typeof adminVoucherStatuses)[number];
export type AdminVoucherEmailDeliveryStatus =
  (typeof adminVoucherEmailDeliveryStatuses)[number];

export type AdminVoucherFilters = {
  code?: string;
  person?: string;
  orderStatus?: AdminVoucherOrderStatus;
  paymentStatus?: AdminPaymentStatus;
  voucherStatus?: AdminVoucherStatus;
  emailDeliveryStatus?: AdminVoucherEmailDeliveryStatus;
  dateFrom?: Date;
  dateToExclusive?: Date;
};

const latestPaymentStatus = sql<AdminPaymentStatus | null>`(
  select p.status
  from payments p
  where p.voucher_order_id = ${voucherOrders.id}
  order by p.created_at desc, p.id desc
  limit 1
)`;

export const getAdminVoucherOrders = async (
  session: AdminSession,
  filters: AdminVoucherFilters,
) => {
  if (!isOwner(session)) return [];

  const code = filters.code?.trim().slice(0, 100);
  const person = filters.person?.trim().slice(0, 100);

  return db
    .select({
      orderId: voucherOrders.id,
      orderStatus: voucherOrders.status,
      orderCreatedAt: voucherOrders.createdAt,
      buyerFirstName: voucherOrders.buyerFirstName,
      buyerLastName: voucherOrders.buyerLastName,
      buyerEmail: voucherOrders.buyerEmail,
      recipientName: voucherOrders.recipientName,
      deliveryType: voucherOrders.deliveryType,
      paperSentAt: voucherOrders.paperSentAt,
      massageName: voucherOrders.massageNameSnapshot,
      durationMinutes: voucherOrders.durationMinutesSnapshot,
      durationLabel: voucherOrders.durationLabelSnapshot,
      amountGrosze: voucherOrders.totalAmountGrosze,
      currency: voucherOrders.currency,
      paymentStatus: latestPaymentStatus,
      voucherId: vouchers.id,
      voucherCode: vouchers.code,
      voucherStatus: vouchers.status,
      emailDeliveryStatus: vouchers.emailDeliveryStatus,
      expiresAt: vouchers.expiresAt,
    })
    .from(voucherOrders)
    .leftJoin(vouchers, eq(vouchers.voucherOrderId, voucherOrders.id))
    .where(
      and(
        code
          ? or(
              ilike(vouchers.code, `%${code}%`),
              ilike(sql`${voucherOrders.id}::text`, `%${code}%`),
            )
          : undefined,
        person
          ? or(
              ilike(voucherOrders.buyerFirstName, `%${person}%`),
              ilike(voucherOrders.buyerLastName, `%${person}%`),
              ilike(voucherOrders.buyerEmail, `%${person}%`),
              ilike(voucherOrders.recipientName, `%${person}%`),
              ilike(
                sql`${voucherOrders.buyerFirstName} || ' ' || ${voucherOrders.buyerLastName}`,
                `%${person}%`,
              ),
            )
          : undefined,
        filters.orderStatus
          ? eq(voucherOrders.status, filters.orderStatus)
          : undefined,
        filters.paymentStatus
          ? sql`${latestPaymentStatus} = ${filters.paymentStatus}`
          : undefined,
        filters.voucherStatus
          ? eq(vouchers.status, filters.voucherStatus)
          : undefined,
        filters.emailDeliveryStatus
          ? eq(vouchers.emailDeliveryStatus, filters.emailDeliveryStatus)
          : undefined,
        filters.dateFrom
          ? gte(voucherOrders.createdAt, filters.dateFrom)
          : undefined,
        filters.dateToExclusive
          ? lt(voucherOrders.createdAt, filters.dateToExclusive)
          : undefined,
      ),
    )
    .orderBy(desc(voucherOrders.createdAt));
};

export const getAdminVoucherOrderById = async (
  session: AdminSession,
  orderId: string,
) => {
  if (
    !isOwner(session) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      orderId,
    )
  ) {
    return null;
  }

  const [order] = await db
    .select({
      orderId: voucherOrders.id,
      orderStatus: voucherOrders.status,
      voucherType: voucherOrders.voucherType,
      massageId: voucherOrders.massageId,
      massageVariantId: voucherOrders.massageVariantId,
      massageName: voucherOrders.massageNameSnapshot,
      durationMinutes: voucherOrders.durationMinutesSnapshot,
      durationLabel: voucherOrders.durationLabelSnapshot,
      priceGrosze: voucherOrders.priceGroszeSnapshot,
      amountGrosze: voucherOrders.totalAmountGrosze,
      voucherValueGrosze: voucherOrders.amountGrosze,
      deliveryType: voucherOrders.deliveryType,
      deliveryFeeGrosze: voucherOrders.deliveryFeeGrosze,
      shippingFirstName: voucherOrders.shippingFirstName,
      shippingLastName: voucherOrders.shippingLastName,
      shippingStreet: voucherOrders.shippingStreet,
      shippingBuildingNumber: voucherOrders.shippingBuildingNumber,
      shippingApartmentNumber: voucherOrders.shippingApartmentNumber,
      shippingPostalCode: voucherOrders.shippingPostalCode,
      shippingCity: voucherOrders.shippingCity,
      paperSentAt: voucherOrders.paperSentAt,
      currency: voucherOrders.currency,
      buyerFirstName: voucherOrders.buyerFirstName,
      buyerLastName: voucherOrders.buyerLastName,
      buyerEmail: voucherOrders.buyerEmail,
      recipientName: voucherOrders.recipientName,
      message: voucherOrders.message,
      orderCreatedAt: voucherOrders.createdAt,
      orderUpdatedAt: voucherOrders.updatedAt,
      voucherId: vouchers.id,
      voucherCode: vouchers.code,
      voucherStatus: vouchers.status,
      voucherAmountGrosze: vouchers.amountGrosze,
      voucherCurrency: vouchers.currency,
      issuedAt: vouchers.issuedAt,
      expiresAt: vouchers.expiresAt,
      redeemedAt: vouchers.redeemedAt,
      voucherCancelledAt: vouchers.cancelledAt,
      voucherCreatedAt: vouchers.createdAt,
      voucherUpdatedAt: vouchers.updatedAt,
      emailDeliveryStatus: vouchers.emailDeliveryStatus,
      emailAttemptedAt: vouchers.emailAttemptedAt,
      emailSentAt: vouchers.emailSentAt,
      emailLastError: vouchers.emailLastError,
    })
    .from(voucherOrders)
    .leftJoin(vouchers, eq(vouchers.voucherOrderId, voucherOrders.id))
    .where(eq(voucherOrders.id, orderId))
    .limit(1);

  if (!order) return null;

  const paymentAttempts = await db
    .select({
      id: payments.id,
      provider: payments.provider,
      status: payments.status,
      checkoutSessionId: payments.providerCheckoutSessionId,
      paymentIntentId: payments.providerPaymentIntentId,
      amountGrosze: payments.amountGrosze,
      currency: payments.currency,
      paidAt: payments.paidAt,
      failedAt: payments.failedAt,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
    })
    .from(payments)
    .where(eq(payments.voucherOrderId, orderId))
    .orderBy(desc(payments.createdAt), desc(payments.id));

  return {
    ...order,
    paymentAttempts,
    pdfGenerationAvailable: order.voucherId !== null,
    pdfDownloadAvailable: order.voucherId !== null,
  };
};
