import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "../src/db";
import {
  bookingEvents,
  bookings,
  massageVariants,
  massages,
  payments,
  voucherEvents,
  voucherOrders,
  vouchers,
} from "../src/db/schema";
import {
  handleFailedVoucherTopUpCheckoutSession,
  handlePaidVoucherTopUpCheckoutSession,
} from "../src/server/payments/booking-stripe-webhook.service";
import { resolveVoucherBookingByCode } from "../src/server/vouchers/voucher-reservation.service";

const databaseUrl = process.env.DATABASE_URL;
if (
  !databaseUrl ||
  !["localhost", "127.0.0.1", "::1"].includes(
    new URL(databaseUrl).hostname,
  )
) {
  throw new Error("Voucher top-up smoke test may run only against local PostgreSQL.");
}

const [variant] = await db
  .select({
    massageId: massages.id,
    variantId: massageVariants.id,
    massageName: massages.name,
    durationMinutes: massageVariants.durationMinutes,
    durationLabel: massageVariants.durationLabel,
    bookingSlotMinutes: massageVariants.bookingSlotMinutes,
    priceGrosze: massageVariants.priceGrosze,
  })
  .from(massageVariants)
  .innerJoin(massages, eq(massageVariants.massageId, massages.id))
  .limit(1);
if (!variant) throw new Error("No massage variant in local database.");

const prefix = `voucher-topup-${randomUUID().slice(0, 8)}`;
const created = { orders: [] as string[], vouchers: [] as string[], bookings: [] as string[], payments: [] as string[] };

const createFixture = async ({
  expiresAt = new Date(Date.now() + 30 * 60_000),
}: { expiresAt?: Date } = {}) => {
  const orderId = randomUUID();
  const voucherId = randomUUID();
  const bookingId = randomUUID();
  const paymentId = randomUUID();
  const checkoutId = `cs_test_${randomUUID().replaceAll("-", "")}`;
  const now = new Date();
  const startAt = new Date(Date.now() + 5 * 24 * 60 * 60_000 + created.bookings.length * 3_600_000);
  const endAt = new Date(startAt.getTime() + variant.bookingSlotMinutes * 60_000);
  created.orders.push(orderId);
  created.vouchers.push(voucherId);
  created.bookings.push(bookingId);
  created.payments.push(paymentId);

  await db.insert(voucherOrders).values({
    id: orderId,
    status: "paid",
    voucherType: "service",
    massageId: variant.massageId,
    massageVariantId: variant.variantId,
    massageNameSnapshot: variant.massageName,
    durationMinutesSnapshot: variant.durationMinutes,
    durationLabelSnapshot: variant.durationLabel,
    bookingSlotMinutesSnapshot: variant.bookingSlotMinutes,
    priceGroszeSnapshot: variant.priceGrosze,
    amountGrosze: variant.priceGrosze,
    addonsTotalGrosze: 0,
    totalAmountGrosze: variant.priceGrosze,
    buyerFirstName: "Test",
    buyerLastName: "Top-up",
    buyerEmail: `${prefix}@example.test`,
  });
  await db.insert(vouchers).values({
    id: voucherId,
    voucherOrderId: orderId,
    code: `ORHEA-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
    status: "reserved",
    bookingTokenHash: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
    voucherType: "service",
    massageId: variant.massageId,
    massageVariantId: variant.variantId,
    massageNameSnapshot: variant.massageName,
    durationMinutesSnapshot: variant.durationMinutes,
    durationLabelSnapshot: variant.durationLabel,
    bookingSlotMinutesSnapshot: variant.bookingSlotMinutes,
    priceGroszeSnapshot: variant.priceGrosze,
    amountGrosze: variant.priceGrosze,
    issuedAt: now,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
  });
  await db.insert(bookings).values({
    id: bookingId,
    status: "pending",
    source: "public",
    voucherId,
    paymentMethod: "voucher",
    paymentStatus: "pending",
    paymentExpiresAt: expiresAt,
    voucherTopUpAmountGrosze: 2500,
    publicCreationKey: randomUUID(),
    massageId: variant.massageId,
    massageVariantId: variant.variantId,
    massageNameSnapshot: variant.massageName,
    durationMinutesSnapshot: variant.durationMinutes,
    durationLabelSnapshot: variant.durationLabel,
    bookingSlotMinutesSnapshot: variant.bookingSlotMinutes,
    priceGroszeSnapshot: variant.priceGrosze,
    totalPriceGroszeSnapshot: variant.priceGrosze,
    specialistId: "adrian",
    requestedStartAt: startAt,
    requestedEndAt: endAt,
    locationType: "salon",
    customerFirstName: "Test",
    customerLastName: "Top-up",
    customerEmail: `${prefix}@example.test`,
    customerPhone: "123456789",
    contactByEmail: true,
    contactByPhone: false,
    termsAcceptedAt: now,
    privacyAcceptedAt: now,
  });
  await db.insert(payments).values({
    id: paymentId,
    bookingId,
    voucherOrderId: null,
    provider: "stripe",
    status: "pending",
    providerCheckoutSessionId: checkoutId,
    amountGrosze: 2500,
    currency: "PLN",
  });
  return { bookingId, voucherId, paymentId, checkoutId };
};

const paidSession = ({ bookingId, voucherId, checkoutId, amount = 2500, currency = "pln" }: {
  bookingId: string;
  voucherId: string;
  checkoutId: string;
  amount?: number;
  currency?: string;
}) => ({
  id: checkoutId,
  payment_status: "paid",
  amount_total: amount,
  currency,
  payment_intent: `pi_${randomUUID().replaceAll("-", "")}`,
  metadata: { paymentKind: "voucher_top_up", bookingId, voucherId },
}) as unknown as Stripe.Checkout.Session;

try {
  // Expired/failed Checkout releases both booking hold and voucher reservation.
  const failed = await createFixture();
  await handleFailedVoucherTopUpCheckoutSession(paidSession(failed));
  const [failedBooking] = await db.select({ status: bookings.status, paymentStatus: bookings.paymentStatus })
    .from(bookings).where(eq(bookings.id, failed.bookingId));
  const [releasedVoucher] = await db.select({ status: vouchers.status })
    .from(vouchers).where(eq(vouchers.id, failed.voucherId));
  const [failedPayment] = await db.select({ status: payments.status })
    .from(payments).where(eq(payments.id, failed.paymentId));
  assert.equal(failedBooking?.status, "payment_expired");
  assert.equal(failedBooking?.paymentStatus, "failed");
  assert.equal(releasedVoucher?.status, "active");
  assert.equal(failedPayment?.status, "failed");

  // A prior payment_expired booking must not hide a newer pending hold for the
  // same voucher. Resolving the voucher is the recovery path when an expiry
  // webhook was lost, so it must release the current hold, not an arbitrary
  // historical booking row.
  const retryBookingId = randomUUID();
  created.bookings.push(retryBookingId);
  const retryStartAt = new Date(Date.now() + 8 * 24 * 60 * 60_000);
  const retryEndAt = new Date(retryStartAt.getTime() + variant.bookingSlotMinutes * 60_000);
  await db.update(vouchers).set({ status: "reserved" }).where(eq(vouchers.id, failed.voucherId));
  await db.insert(bookings).values({
    id: retryBookingId,
    status: "pending",
    source: "public",
    voucherId: failed.voucherId,
    paymentMethod: "voucher",
    paymentStatus: "pending",
    paymentExpiresAt: new Date(Date.now() - 1_000),
    voucherTopUpAmountGrosze: 2500,
    publicCreationKey: randomUUID(),
    massageId: variant.massageId,
    massageVariantId: variant.variantId,
    massageNameSnapshot: variant.massageName,
    durationMinutesSnapshot: variant.durationMinutes,
    durationLabelSnapshot: variant.durationLabel,
    bookingSlotMinutesSnapshot: variant.bookingSlotMinutes,
    priceGroszeSnapshot: variant.priceGrosze,
    totalPriceGroszeSnapshot: variant.priceGrosze,
    specialistId: "adrian",
    requestedStartAt: retryStartAt,
    requestedEndAt: retryEndAt,
    locationType: "salon",
    customerFirstName: "Test",
    customerLastName: "Retry",
    customerEmail: `${prefix}@example.test`,
    customerPhone: "123456789",
    contactByEmail: true,
    contactByPhone: false,
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
  });
  const [retryVoucher] = await db.select({ code: vouchers.code, status: vouchers.status })
    .from(vouchers).where(eq(vouchers.id, failed.voucherId));
  assert.equal(retryVoucher?.status, "reserved");
  const resolvedRetryVoucher = await resolveVoucherBookingByCode(retryVoucher!.code);
  assert.equal(resolvedRetryVoucher.state, "active");
  const [releasedRetryBooking] = await db.select({ status: bookings.status })
    .from(bookings).where(eq(bookings.id, retryBookingId));
  assert.equal(releasedRetryBooking?.status, "payment_expired");

  // A paid webhook is idempotent and settles only the top-up amount. The
  // deliberately expired local hold takes the late-payment/manual path, so no
  // Google or email integration is invoked in this isolated DB test. It must
  // remain non-blocking and release the voucher rather than revive the hold.
  const late = await createFixture({ expiresAt: new Date(Date.now() - 1_000) });
  const session = paidSession(late);
  await handlePaidVoucherTopUpCheckoutSession(session);
  await handlePaidVoucherTopUpCheckoutSession(session);
  const [paidBooking] = await db.select({ status: bookings.status, paymentStatus: bookings.paymentStatus, paymentPaidAt: bookings.paymentPaidAt })
    .from(bookings).where(eq(bookings.id, late.bookingId));
  const [paidPayment] = await db.select({ status: payments.status, amountGrosze: payments.amountGrosze })
    .from(payments).where(eq(payments.id, late.paymentId));
  assert.equal(paidBooking?.status, "payment_expired");
  assert.equal(paidBooking?.paymentStatus, "paid");
  assert.ok(paidBooking?.paymentPaidAt);
  assert.equal(paidPayment?.status, "paid");
  assert.equal(paidPayment?.amountGrosze, 2500);
  const [lateVoucher] = await db.select({ status: vouchers.status })
    .from(vouchers).where(eq(vouchers.id, late.voucherId));
  assert.equal(lateVoucher?.status, "active");
  const paidEvents = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, late.bookingId));
  assert.equal(paidEvents.filter((event) => event.eventType === "payment_paid").length, 1);

  const mismatch = await createFixture({ expiresAt: new Date(Date.now() - 1_000) });
  await assert.rejects(
    handlePaidVoucherTopUpCheckoutSession(paidSession({ ...mismatch, amount: 2501 })),
    /STRIPE_VOUCHER_TOP_UP_PAYMENT_MISMATCH/,
  );
} finally {
  if (created.bookings.length) {
    await db.delete(bookingEvents).where(inArray(bookingEvents.bookingId, created.bookings));
  }
  if (created.vouchers.length) {
    await db.delete(voucherEvents).where(inArray(voucherEvents.voucherId, created.vouchers));
  }
  if (created.payments.length) await db.delete(payments).where(inArray(payments.id, created.payments));
  if (created.bookings.length) await db.delete(bookings).where(inArray(bookings.id, created.bookings));
  if (created.vouchers.length) await db.delete(vouchers).where(inArray(vouchers.id, created.vouchers));
  if (created.orders.length) await db.delete(voucherOrders).where(inArray(voucherOrders.id, created.orders));
}

console.log("Voucher top-up payments: release, paid webhook and late-payment safety OK.");
