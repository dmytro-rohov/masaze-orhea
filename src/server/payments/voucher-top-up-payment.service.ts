import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookings, payments } from "@/db/schema";

import { BOOKING_PAYMENT_HOLD_MINUTES } from "./booking-payment.config";
import { stripe } from "./stripe.service";

export class VoucherTopUpCheckoutError extends Error {
  constructor(
    public readonly code:
      | "INVALID_STATE"
      | "PAYMENT_PROCESSING"
      | "STRIPE_UNAVAILABLE",
  ) {
    super(code);
  }
}

const createVoucherTopUpStripeSession = async ({
  bookingId,
  voucherId,
  customerEmail,
  amountGrosze,
  origin,
  idempotencyKey,
}: {
  bookingId: string;
  voucherId: string;
  customerEmail: string;
  amountGrosze: number;
  origin: string;
  idempotencyKey: string;
}) => stripe.checkout.sessions.create({
  mode: "payment",
  customer_email: customerEmail,
  line_items: [{
    quantity: 1,
    price_data: {
      currency: "pln",
      unit_amount: amountGrosze,
      product_data: {
        name: "Dopłata do rezerwacji ORHEA — dodatki",
      },
    },
  }],
  metadata: {
    paymentKind: "voucher_top_up",
    bookingId,
    voucherId,
  },
  expires_at: Math.floor(Date.now() / 1000) + BOOKING_PAYMENT_HOLD_MINUTES * 60,
  success_url: `${origin}/rezerwacja?payment=voucher-top-up-success`,
  cancel_url: `${origin}/rezerwacja?payment=voucher-top-up-cancel`,
}, { idempotencyKey });

/**
 * Creates or retrieves the Checkout for a reservation that is already held in
 * PostgreSQL. The voucher service owns creation/release of that hold; this
 * boundary owns only the Stripe attempt and its payment row.
 */
export const createVoucherTopUpCheckout = async ({
  bookingId,
  origin,
}: {
  bookingId: string;
  origin: string;
}): Promise<string> => {
  let createdSessionId: string | null = null;

  try {
    return await db.transaction(async (tx) => {
      const [booking] = await tx
        .select({
          id: bookings.id,
          status: bookings.status,
          voucherId: bookings.voucherId,
          paymentMethod: bookings.paymentMethod,
          paymentStatus: bookings.paymentStatus,
          paymentExpiresAt: bookings.paymentExpiresAt,
          voucherTopUpAmountGrosze: bookings.voucherTopUpAmountGrosze,
          customerEmail: bookings.customerEmail,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for("update")
        .limit(1);

      if (
        !booking ||
        !booking.voucherId ||
        booking.status !== "pending" ||
        booking.paymentMethod !== "voucher" ||
        booking.paymentStatus !== "pending" ||
        !booking.paymentExpiresAt ||
        booking.paymentExpiresAt <= new Date() ||
        booking.voucherTopUpAmountGrosze <= 0
      ) {
        throw new VoucherTopUpCheckoutError("INVALID_STATE");
      }

      const [previous] = await tx
        .select()
        .from(payments)
        .where(eq(payments.bookingId, booking.id))
        .orderBy(desc(payments.createdAt), desc(payments.id))
        .limit(1);

      if (previous?.status === "pending") {
        const active = await stripe.checkout.sessions.retrieve(
          previous.providerCheckoutSessionId,
        );
        if (
          active.status === "open" &&
          active.expires_at > Math.floor(Date.now() / 1000) &&
          active.url
        ) {
          return active.url;
        }
        if (active.status === "complete") {
          throw new VoucherTopUpCheckoutError("PAYMENT_PROCESSING");
        }
        if (active.status === "open") {
          await stripe.checkout.sessions.expire(active.id);
        }
        await tx
          .update(payments)
          .set({ status: "failed", failedAt: new Date(), updatedAt: new Date() })
          .where(eq(payments.id, previous.id));
      }

      const paymentId = randomUUID();
      const session = await createVoucherTopUpStripeSession({
        bookingId: booking.id,
        voucherId: booking.voucherId,
        customerEmail: booking.customerEmail,
        amountGrosze: booking.voucherTopUpAmountGrosze,
        origin,
        idempotencyKey: `voucher-top-up:${booking.id}:${paymentId}`,
      });
      createdSessionId = session.id;
      if (!session.url) {
        throw new VoucherTopUpCheckoutError("STRIPE_UNAVAILABLE");
      }

      const now = new Date();
      await tx.insert(payments).values({
        id: paymentId,
        bookingId: booking.id,
        voucherOrderId: null,
        provider: "stripe",
        status: "pending",
        providerCheckoutSessionId: session.id,
        amountGrosze: booking.voucherTopUpAmountGrosze,
        currency: "PLN",
      });
      await tx
        .update(bookings)
        .set({
          paymentExpiresAt: new Date(session.expires_at * 1000),
          updatedAt: now,
        })
        .where(eq(bookings.id, booking.id));

      return session.url;
    });
  } catch (error) {
    if (createdSessionId) {
      try {
        await stripe.checkout.sessions.expire(createdSessionId);
      } catch (expireError) {
        console.error("Voucher top-up Checkout cleanup failed:", {
          bookingId,
          expireError,
        });
      }
    }
    if (error instanceof VoucherTopUpCheckoutError) throw error;
    console.error("Voucher top-up Checkout creation failed:", { bookingId, error });
    throw new VoucherTopUpCheckoutError("STRIPE_UNAVAILABLE");
  }
};
