import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookingEvents, bookings, payments } from "@/db/schema";
import type { AdminSession } from "./admin-auth.service";
import { isOwner } from "./admin-authorization.service";
import { createBookingStripeSession } from "@/server/payments/booking-checkout.service";
import { stripe } from "@/server/payments/stripe.service";
import { sendBookingCustomerNotification } from "@/server/bookings/booking-customer-notification.service";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AdminBookingPaymentLinkError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE" | "PAYMENT_PROCESSING" | "STRIPE_UNAVAILABLE" | "EMAIL_FAILED") {
    super(code);
  }
}

const assertOwner = (session: AdminSession) => {
  if (!isOwner(session)) throw new AdminBookingPaymentLinkError("FORBIDDEN");
};

export const getAdminBookingPaymentLink = async (
  session: AdminSession,
  bookingId: string,
  origin: string,
): Promise<{ checkoutUrl: string; paymentStatus: "pending"; reused: boolean }> => {
  assertOwner(session);
  if (!uuidPattern.test(bookingId)) throw new AdminBookingPaymentLinkError("NOT_FOUND");

  let createdSessionId: string | null = null;
  try {
    return await db.transaction(async (tx) => {
      // One owner action at a time for this booking; Stripe retrieval/creation is
      // deliberately inside the lock so double clicks cannot create two links.
      const [booking] = await tx.select().from(bookings)
        .where(eq(bookings.id, bookingId)).for("update").limit(1);
      if (!booking) throw new AdminBookingPaymentLinkError("NOT_FOUND");
      if (
        ["cancelled", "rejected"].includes(booking.status) ||
        ["paid", "refunded"].includes(booking.paymentStatus) ||
        (booking.paymentMethod === "online" && booking.paymentExpiresAt !== null) ||
        booking.totalPriceGroszeSnapshot <= 0
      ) throw new AdminBookingPaymentLinkError("INVALID_STATE");

      const [previous] = await tx.select().from(payments)
        .where(eq(payments.bookingId, booking.id))
        .orderBy(desc(payments.createdAt), desc(payments.id)).limit(1);

      if (previous?.status === "pending") {
        const active = await stripe.checkout.sessions.retrieve(previous.providerCheckoutSessionId);
        if (active.status === "open" && active.expires_at > Math.floor(Date.now() / 1000) && active.url) {
          if (booking.paymentMethod !== "online" || booking.paymentStatus !== "pending") {
            await tx.update(bookings).set({
              paymentMethod: "online", paymentStatus: "pending", paymentExpiresAt: null, updatedAt: new Date(),
            }).where(eq(bookings.id, booking.id));
          }
          return { checkoutUrl: active.url, paymentStatus: "pending" as const, reused: true };
        }
        if (active.status === "complete") throw new AdminBookingPaymentLinkError("PAYMENT_PROCESSING");
        if (active.status === "open") {
          await stripe.checkout.sessions.expire(active.id);
        }
        await tx.update(payments).set({ status: "failed", failedAt: new Date(), updatedAt: new Date() })
          .where(eq(payments.id, previous.id));
      }

      const paymentId = randomUUID();
      const sessionResult = await createBookingStripeSession({
        bookingId: booking.id,
        massageName: booking.massageNameSnapshot,
        customerEmail: booking.customerEmail,
        amountGrosze: booking.totalPriceGroszeSnapshot,
        origin,
        idempotencyKey: `admin-booking-checkout:${paymentId}`,
        existingBooking: true,
      });
      createdSessionId = sessionResult.id;
      if (!sessionResult.url) throw new AdminBookingPaymentLinkError("STRIPE_UNAVAILABLE");

      const now = new Date();
      await tx.insert(payments).values({
        id: paymentId,
        bookingId: booking.id,
        voucherOrderId: null,
        provider: "stripe",
        status: "pending",
        providerCheckoutSessionId: sessionResult.id,
        amountGrosze: booking.totalPriceGroszeSnapshot,
        currency: "PLN",
      });
      await tx.update(bookings).set({
        paymentMethod: "online",
        paymentStatus: "pending",
        // NULL means this is an existing reservation, not a temporary public hold.
        paymentExpiresAt: null,
        updatedAt: now,
      }).where(eq(bookings.id, booking.id));
      await tx.insert(bookingEvents).values({
        bookingId: booking.id,
        eventType: "payment_link_created",
        actorUsername: session.username,
        actorRole: session.role,
        createdAt: now,
      });
      return { checkoutUrl: sessionResult.url, paymentStatus: "pending" as const, reused: false };
    });
  } catch (error) {
    if (createdSessionId) {
      try { await stripe.checkout.sessions.expire(createdSessionId); }
      catch (expireError) { console.error("Admin booking Checkout cleanup failed:", { bookingId, expireError }); }
    }
    if (error instanceof AdminBookingPaymentLinkError) throw error;
    console.error("Admin booking payment link failed:", { bookingId, error });
    throw new AdminBookingPaymentLinkError("STRIPE_UNAVAILABLE");
  }
};

export const sendAdminBookingPaymentLink = async (
  session: AdminSession,
  bookingId: string,
  origin: string,
) => {
  const link = await getAdminBookingPaymentLink(session, bookingId, origin);
  try {
    await sendBookingCustomerNotification({
      bookingId,
      event: "payment_link",
      idempotencyKey: randomUUID(),
      checkoutUrl: link.checkoutUrl,
    });
    await db.insert(bookingEvents).values({
      bookingId,
      eventType: "payment_link_sent",
      actorUsername: session.username,
      actorRole: session.role,
    });
  } catch (error) {
    console.error("Admin booking payment link email failed:", { bookingId, error });
    throw new AdminBookingPaymentLinkError("EMAIL_FAILED");
  }
  return link;
};
