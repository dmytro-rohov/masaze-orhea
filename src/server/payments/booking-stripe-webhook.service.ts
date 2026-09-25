import type Stripe from "stripe";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookingEvents, bookings, payments } from "@/db/schema";
import { assertBookingSlotAvailable, busyPeriodsOverlap, getBookingBusyPeriods } from "@/server/bookings/booking.availability";
import { getBookingBufferMinutes } from "@/server/bookings/booking-settings.service";
import { assertBookingTimeWindow } from "@/server/bookings/booking-time-window.service";
import { getBookingZonedDateTime, MILLISECONDS_PER_MINUTE } from "@/server/bookings/booking-time-zone";
import { syncBookingToGoogleCalendar } from "@/server/bookings/booking-calendar-sync.service";
import { attemptBookingCustomerNotification } from "@/server/bookings/booking-customer-notification.service";
import type { BookingSpecialistId } from "@/server/bookings/booking.types";

export const handlePaidBookingCheckoutSession = async (
  session: Stripe.Checkout.Session,
): Promise<void> => {
  if (session.payment_status !== "paid") return;
  const result = await db.transaction(async (tx) => {
    const [paymentCandidate] = await tx.select().from(payments)
      .where(and(eq(payments.provider, "stripe"), eq(payments.providerCheckoutSessionId, session.id)))
      .limit(1);
    if (!paymentCandidate?.bookingId || paymentCandidate.voucherOrderId) throw new Error("STRIPE_BOOKING_PAYMENT_NOT_FOUND");
    if (session.metadata?.paymentKind !== "booking" || session.metadata.bookingId !== paymentCandidate.bookingId) {
      throw new Error("STRIPE_BOOKING_METADATA_MISMATCH");
    }

    const [booking] = await tx.select().from(bookings)
      .where(eq(bookings.id, paymentCandidate.bookingId)).for("update").limit(1);
    const [payment] = await tx.select().from(payments)
      .where(eq(payments.id, paymentCandidate.id)).for("update").limit(1);
    if (!booking || booking.paymentMethod !== "online" ||
      session.amount_total !== payment.amountGrosze ||
      payment.amountGrosze !== booking.totalPriceGroszeSnapshot ||
      session.currency?.toUpperCase() !== payment.currency.toUpperCase() ||
      payment.currency !== "PLN") {
      throw new Error("STRIPE_BOOKING_PAYMENT_MISMATCH");
    }
    if (payment.status === "paid") return { finalized: false, booking };

    const existingReservationLink = booking.paymentExpiresAt === null;
    const bufferMinutes = existingReservationLink ? 0 : await getBookingBufferMinutes();

    const startAt = booking.confirmedStartAt ?? booking.requestedStartAt;
    const endAt = booking.confirmedEndAt ?? booking.requestedEndAt;
    const date = getBookingZonedDateTime(startAt).dateKey;
    if (!existingReservationLink) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${booking.specialistId}:${date}`}))`);
    }

    let safeToFinalize = existingReservationLink
      ? !["cancelled", "rejected"].includes(booking.status) && booking.paymentStatus === "pending"
      : booking.status === "pending" && booking.paymentStatus === "pending";
    if (safeToFinalize && !existingReservationLink) {
      const effectiveEnd = new Date(endAt.getTime() + bufferMinutes * MILLISECONDS_PER_MINUTE);
      const busy = await getBookingBusyPeriods({
        specialistId: booking.specialistId as BookingSpecialistId,
        timeMin: startAt,
        timeMax: effectiveEnd,
        bufferMinutes,
        excludeBookingId: booking.id,
        executor: tx,
      });
      safeToFinalize = !busy.some((period) => busyPeriodsOverlap(period, startAt, effectiveEnd));
    }
    if (safeToFinalize && !existingReservationLink && booking.paymentExpiresAt && booking.paymentExpiresAt <= new Date()) {
      // Webhooks may arrive late. Once the hold has expired, availability is
      // rechecked under the same specialist/day lock used by booking creation.
      safeToFinalize = startAt > new Date();
      if (safeToFinalize) {
        try {
          await assertBookingTimeWindow({
            specialistId: booking.specialistId as BookingSpecialistId,
            startAt,
            endAt,
            bufferMinutes,
          });
          await assertBookingSlotAvailable({
            specialistId: booking.specialistId as BookingSpecialistId,
            startAt,
            endAt,
            bufferMinutes,
            excludeBookingId: booking.id,
          });
        } catch (error) {
          safeToFinalize = false;
          console.error("Paid booking needs manual resolution after hold expiry:", { bookingId: booking.id, error });
        }
      }
    }

    const paidAt = new Date();
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
    await tx.update(payments).set({
      status: "paid",
      providerPaymentIntentId: paymentIntentId,
      paidAt,
      updatedAt: paidAt,
    }).where(eq(payments.id, payment.id));
    await tx.update(bookings).set({
      paymentStatus: "paid",
      paymentPaidAt: paidAt,
      paymentExpiresAt: safeToFinalize ? null : booking.paymentExpiresAt,
      updatedAt: paidAt,
    }).where(eq(bookings.id, booking.id));
    if (existingReservationLink) {
      await tx.insert(bookingEvents).values({
        bookingId: booking.id,
        eventType: "payment_paid",
        createdAt: paidAt,
      });
    }
    return { finalized: safeToFinalize, booking, existingReservationLink };
  });

  if (!result.finalized) {
    if (result.booking.paymentExpiresAt || result.booking.status === "cancelled" || result.booking.status === "rejected" || result.existingReservationLink) {
      console.error("Paid booking not finalized; manual payment/slot resolution required:", { bookingId: result.booking.id });
    }
    return;
  }

  if (result.existingReservationLink) {
    await attemptBookingCustomerNotification({
      bookingId: result.booking.id,
      event: "payment_received_existing",
      idempotencyKey: session.id,
    });
    return;
  }

  try {
    await syncBookingToGoogleCalendar({
      ...result.booking,
      specialistId: result.booking.specialistId as BookingSpecialistId,
    });
  } catch (error) {
    console.error("Paid booking Google OUTPUT synchronization state update failed:", { bookingId: result.booking.id, error });
  }
  await attemptBookingCustomerNotification({
    bookingId: result.booking.id,
    event: "payment_received",
    idempotencyKey: session.id,
  });
};

export const handleFailedBookingCheckoutSession = async (
  session: Stripe.Checkout.Session,
): Promise<void> => {
  await db.transaction(async (tx) => {
    const [paymentCandidate] = await tx.select().from(payments)
      .where(and(eq(payments.provider, "stripe"), eq(payments.providerCheckoutSessionId, session.id)))
      .limit(1);
    if (!paymentCandidate?.bookingId || paymentCandidate.voucherOrderId ||
      session.metadata?.paymentKind !== "booking" || session.metadata.bookingId !== paymentCandidate.bookingId) {
      throw new Error("STRIPE_BOOKING_PAYMENT_NOT_FOUND");
    }
    await tx.select({ id: bookings.id }).from(bookings)
      .where(eq(bookings.id, paymentCandidate.bookingId)).for("update").limit(1);
    const [payment] = await tx.select().from(payments)
      .where(eq(payments.id, paymentCandidate.id)).for("update").limit(1);
    if (!payment?.bookingId) throw new Error("STRIPE_BOOKING_PAYMENT_NOT_FOUND");
    if (payment.status === "paid" || payment.status === "failed") return;

    const now = new Date();
    await tx.update(payments).set({ status: "failed", failedAt: now, updatedAt: now })
      .where(eq(payments.id, payment.id));
    const [latest] = await tx.select({ id: payments.id }).from(payments)
      .where(eq(payments.bookingId, payment.bookingId))
      .orderBy(desc(payments.createdAt), desc(payments.id)).limit(1);
    if (latest?.id === payment.id) {
      const [booking] = await tx.select({ paymentExpiresAt: bookings.paymentExpiresAt }).from(bookings)
        .where(eq(bookings.id, payment.bookingId)).limit(1);
      await tx.update(bookings).set({
        paymentStatus: "failed",
        paymentExpiresAt: booking?.paymentExpiresAt === null ? null : now,
        updatedAt: now,
      }).where(and(eq(bookings.id, payment.bookingId), eq(bookings.paymentStatus, "pending")));
    }
  });
};
