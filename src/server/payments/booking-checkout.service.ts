import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookings, payments } from "@/db/schema";
import { stripe } from "./stripe.service";
import { BOOKING_PAYMENT_HOLD_MINUTES } from "./booking-payment.config";

export { BOOKING_PAYMENT_HOLD_MINUTES } from "./booking-payment.config";

export const createBookingStripeSession = async ({
  bookingId, massageName, customerEmail, amountGrosze, origin, idempotencyKey, existingBooking = false,
}: {
  bookingId: string;
  massageName: string;
  customerEmail: string;
  amountGrosze: number;
  origin: string;
  idempotencyKey: string;
  existingBooking?: boolean;
}) => stripe.checkout.sessions.create({
  mode: "payment",
  customer_email: customerEmail,
  line_items: [{
    quantity: 1,
    price_data: {
      currency: "pln",
      unit_amount: amountGrosze,
      product_data: { name: `Rezerwacja ORHEA — ${massageName}` },
    },
  }],
  metadata: { paymentKind: "booking", bookingId },
  expires_at: Math.floor(Date.now() / 1000) + BOOKING_PAYMENT_HOLD_MINUTES * 60,
  success_url: `${origin}/rezerwacja?payment=success`,
  cancel_url: existingBooking ? `${origin}/rezerwacja` : `${origin}/rezerwacja?payment=cancel`,
}, { idempotencyKey });

export const createBookingCheckout = async ({ bookingId, origin }: {
  bookingId: string;
  origin: string;
}): Promise<string> => {
  const [booking] = await db
    .select({
      id: bookings.id,
      massageName: bookings.massageNameSnapshot,
      amountGrosze: bookings.totalPriceGroszeSnapshot,
      customerEmail: bookings.customerEmail,
      expiresAt: bookings.paymentExpiresAt,
    })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.paymentMethod, "online")))
    .limit(1);

  if (!booking || !booking.expiresAt || booking.amountGrosze <= 0) {
    throw new Error("BOOKING_PAYMENT_INVALID_STATE");
  }

  let sessionId: string | null = null;
  try {
    // Stripe's 30-minute minimum is measured from Session creation, not from
    // the earlier DB insert. Refresh the hold to match the actual Session expiry.
    const session = await createBookingStripeSession({
      bookingId: booking.id,
      massageName: booking.massageName,
      customerEmail: booking.customerEmail,
      amountGrosze: booking.amountGrosze,
      origin,
      idempotencyKey: `booking-checkout:${booking.id}`,
    });
    sessionId = session.id;
    if (!session.url) throw new Error("STRIPE_CHECKOUT_URL_MISSING");

    await db.transaction(async (tx) => {
      await tx.insert(payments).values({
        bookingId: booking.id,
        voucherOrderId: null,
        provider: "stripe",
        status: "pending",
        providerCheckoutSessionId: session.id,
        amountGrosze: booking.amountGrosze,
        currency: "PLN",
      });
      await tx.update(bookings).set({
        paymentExpiresAt: new Date(session.expires_at * 1000),
        updatedAt: new Date(),
      }).where(eq(bookings.id, booking.id));
    });
    return session.url;
  } catch (error) {
    if (sessionId) {
      try {
        await stripe.checkout.sessions.expire(sessionId);
      } catch (expireError) {
        console.error("Booking Checkout expiry after persistence failure failed:", { bookingId, expireError });
      }
    }
    await db.update(bookings).set({
      paymentStatus: "failed",
      paymentExpiresAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(bookings.id, booking.id));
    throw error;
  }
};
