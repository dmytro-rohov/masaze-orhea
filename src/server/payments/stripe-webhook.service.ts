import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { payments, voucherOrders } from "../../db/schema";
import { deliverVoucherEmail } from "../vouchers/voucher-email.service";
import { issueVoucherForOrder } from "../vouchers/voucher-issuance.service";

type HandlePaidCheckoutSessionResult = {
  handled: boolean;
  paymentId?: string;
  voucherOrderId?: string;
  voucherId?: string;
  voucherCode?: string;
  voucherAlreadyIssued?: boolean;
};

export const handlePaidCheckoutSession = async (
  session: Stripe.Checkout.Session,
): Promise<HandlePaidCheckoutSessionResult> => {
  if (session.payment_status !== "paid") {
    return {
      handled: false,
    };
  }

  const voucherOrderIdFromMetadata =
    session.metadata?.voucherOrderId?.trim();

  if (!voucherOrderIdFromMetadata) {
    return {
      handled: false,
    };
  }

  const [payment] = await db
    .select({
      id: payments.id,
      voucherOrderId: payments.voucherOrderId,
      status: payments.status,
      amountGrosze: payments.amountGrosze,
      currency: payments.currency,
    })
    .from(payments)
    .where(
      and(
        eq(payments.provider, "stripe"),
        eq(payments.providerCheckoutSessionId, session.id),
      ),
    )
    .limit(1);

  if (!payment) {
    throw new Error("STRIPE_PAYMENT_NOT_FOUND");
  }

  if (voucherOrderIdFromMetadata !== payment.voucherOrderId) {
    throw new Error("STRIPE_VOUCHER_ORDER_MISMATCH");
  }

  if (
    session.amount_total !== null &&
    session.amount_total !== payment.amountGrosze
  ) {
    throw new Error("STRIPE_PAYMENT_AMOUNT_MISMATCH");
  }

  if (
    session.currency &&
    session.currency.toUpperCase() !== payment.currency.toUpperCase()
  ) {
    throw new Error("STRIPE_PAYMENT_CURRENCY_MISMATCH");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const paidAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: "paid",
        providerPaymentIntentId: paymentIntentId,
        paidAt,
        updatedAt: paidAt,
      })
      .where(eq(payments.id, payment.id));

    await tx
      .update(voucherOrders)
      .set({
        status: "paid",
        updatedAt: paidAt,
      })
      .where(eq(voucherOrders.id, payment.voucherOrderId));
  });

  const voucher = await issueVoucherForOrder(payment.voucherOrderId);

  await deliverVoucherEmail(voucher.voucherId);

  return {
    handled: true,
    paymentId: payment.id,
    voucherOrderId: payment.voucherOrderId,
    voucherId: voucher.voucherId,
    voucherCode: voucher.voucherCode,
    voucherAlreadyIssued: voucher.alreadyIssued,
  };
};
