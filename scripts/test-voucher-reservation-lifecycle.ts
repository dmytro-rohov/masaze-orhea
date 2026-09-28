import "dotenv/config";

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { db } from "../src/db";
import {
  addons,
  bookingEvents,
  bookings,
  massageVariants,
  massages,
  voucherEvents,
  voucherOrderAddons,
  voucherOrders,
  vouchers,
} from "../src/db/schema";
import { updateAdminBookingStatus } from "../src/server/admin/admin-booking-status.service";
import {
  redeemAdminVoucher,
  redeemVoucherForCompletedBooking,
  restoreAdminVoucher,
} from "../src/server/admin/admin-voucher-actions.service";
import {
  releaseVoucherReservationForBooking,
  resolveVoucherBookingByCode,
  resolveVoucherBookingByToken,
} from "../src/server/vouchers/voucher-reservation.service";
import { hashVoucherBookingToken } from "../src/server/vouchers/voucher-issuance.service";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname)) {
  throw new Error("This smoke test only runs against a local PostgreSQL database.");
}

process.env.BOOKING_EMAIL_DELIVERY_MODE = "console";

const testId = `voucher-reservation-${randomUUID().slice(0, 8)}`;
const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
const owner = {
  username: "voucher-lifecycle-test",
  role: "owner" as const,
  specialistId: null,
  expiresAt: Math.floor(Date.now() / 1000) + 60,
};
const adrian = {
  username: "adrian-voucher-lifecycle-test",
  role: "specialist" as const,
  specialistId: "adrian" as const,
  expiresAt: Math.floor(Date.now() / 1000) + 60,
};
const aleksandra = {
  username: "aleksandra-voucher-lifecycle-test",
  role: "specialist" as const,
  specialistId: "aleksandra" as const,
  expiresAt: Math.floor(Date.now() / 1000) + 60,
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

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

if (!variant) throw new Error("Missing massage variant in local DB.");

const createdOrderIds: string[] = [];
const createdVoucherIds: string[] = [];
const createdBookingIds: string[] = [];
const addonId = `${testId}-addon`;

const createVoucher = async ({
  status = "active",
  expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  withAddon = false,
  bookingToken = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
}: {
  status?: "active" | "reserved" | "cancelled";
  expiresAt?: Date;
  withAddon?: boolean;
  bookingToken?: string;
} = {}) => {
  const orderId = randomUUID();
  const voucherId = randomUUID();
  createdOrderIds.push(orderId);
  createdVoucherIds.push(voucherId);
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
    addonsTotalGrosze: withAddon ? 3000 : 0,
    totalAmountGrosze: variant.priceGrosze + (withAddon ? 3000 : 0),
    buyerFirstName: "Test",
    buyerLastName: "Voucher",
    buyerEmail: `${testId}@example.test`,
  });
  await db.insert(vouchers).values({
    id: voucherId,
    voucherOrderId: orderId,
    code: `ORHEA-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
    status,
    bookingTokenHash: hashVoucherBookingToken(bookingToken),
    voucherType: "service",
    massageId: variant.massageId,
    massageVariantId: variant.variantId,
    massageNameSnapshot: variant.massageName,
    durationMinutesSnapshot: variant.durationMinutes,
    durationLabelSnapshot: variant.durationLabel,
    bookingSlotMinutesSnapshot: variant.bookingSlotMinutes,
    priceGroszeSnapshot: variant.priceGrosze,
    amountGrosze: variant.priceGrosze,
    issuedAt: expiresAt <= new Date() ? new Date(expiresAt.getTime() - 60_000) : undefined,
    expiresAt,
  });
  if (withAddon) {
    await db.insert(voucherOrderAddons).values({
      voucherOrderId: orderId,
      addonId,
      nameSnapshot: "Historyczny dodatek testowy",
      descriptionSnapshot: "Snapshot pozostaje ważny.",
      priceGroszeSnapshot: 3000,
      treatmentDurationMinutesSnapshot: 15,
      slotExtensionMinutesSnapshot: 15,
    });
  }
  return { orderId, voucherId, bookingToken };
};

const createBooking = async (voucherId: string | null, status: "pending" | "confirmed" | "completed") => {
  const now = new Date();
  const startAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + createdBookingIds.length * 60 * 60 * 1000);
  const endAt = new Date(startAt.getTime() + variant.bookingSlotMinutes * 60_000);
  const [booking] = await db.insert(bookings).values({
    status,
    source: "public",
    voucherId,
    paymentMethod: "voucher",
    paymentStatus: "paid",
    paymentPaidAt: now,
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
    confirmedStartAt: status === "confirmed" || status === "completed" ? startAt : null,
    confirmedEndAt: status === "confirmed" || status === "completed" ? endAt : null,
    confirmedAt: status === "confirmed" || status === "completed" ? now : null,
    locationType: "salon",
    customerFirstName: "Test",
    customerLastName: "Klient",
    customerEmail: `${testId}@example.test`,
    customerPhone: "123456789",
    contactByEmail: true,
    contactByPhone: false,
    termsAcceptedAt: now,
    privacyAcceptedAt: now,
  }).returning({ id: bookings.id });
  assert(booking, "Booking fixture was not created.");
  createdBookingIds.push(booking.id);
  return booking.id;
};

try {
  await db.insert(addons).values({
    id: addonId,
    name: "Historyczny dodatek testowy",
    priceGrosze: 3000,
    treatmentDurationMinutes: 15,
    slotExtensionMinutes: 15,
    isActive: true,
    isConfirmed: true,
  });

  const active = await createVoucher({ withAddon: true, bookingToken: token });
  const normalBookingId = await createBooking(null, "pending");
  const [normalBooking] = await db.select({ voucherId: bookings.voucherId }).from(bookings).where(eq(bookings.id, normalBookingId));
  assert(normalBooking?.voucherId === null, "Normal booking received a voucher relation.");
  const resolved = await resolveVoucherBookingByToken(token);
  assert(resolved.state === "active" && resolved.addons.length === 1, "Active token did not resolve safely.");
  await db.update(addons).set({ isActive: false }).where(eq(addons.id, addonId));
  const resolvedAfterDeactivation = await resolveVoucherBookingByCode(
    (await db.select({ code: vouchers.code }).from(vouchers).where(eq(vouchers.id, active.voucherId)).limit(1))[0]!.code,
  );
  assert(resolvedAfterDeactivation.addons[0]?.name === "Historyczny dodatek testowy", "Voucher entitlement depended on current addon state.");
  await Promise.all([
    resolveVoucherBookingByToken("invalid-token").then(
      () => { throw new Error("Invalid token resolved."); },
      () => undefined,
    ),
    resolveVoucherBookingByCode("ORHEA-INVALID").then(
      () => { throw new Error("Invalid code resolved."); },
      () => undefined,
    ),
  ]);

  await Promise.all([
    db.transaction(async (tx) => {
      const [locked] = await tx.select({ status: vouchers.status }).from(vouchers).where(eq(vouchers.id, active.voucherId)).for("update");
      if (locked?.status === "active") await tx.update(vouchers).set({ status: "reserved" }).where(eq(vouchers.id, active.voucherId));
    }),
    db.transaction(async (tx) => {
      const [locked] = await tx.select({ status: vouchers.status }).from(vouchers).where(eq(vouchers.id, active.voucherId)).for("update");
      if (locked?.status === "active") await tx.update(vouchers).set({ status: "reserved" }).where(eq(vouchers.id, active.voucherId));
    }),
  ]);
  const [reserved] = await db.select({ status: vouchers.status }).from(vouchers).where(eq(vouchers.id, active.voucherId));
  assert(reserved?.status === "reserved", "Concurrent local row locks did not leave one reservation state.");

  const cancelledBookingId = await createBooking(active.voucherId, "confirmed");
  const cancel = await updateAdminBookingStatus(owner, cancelledBookingId, "cancelled");
  assert(cancel.success, "Cancelled voucher booking was not updated.");
  const [released] = await db.select({ status: vouchers.status }).from(vouchers).where(eq(vouchers.id, active.voucherId));
  assert(released?.status === "active", "Cancelled booking did not release voucher.");

  const rejected = await createVoucher({ status: "reserved" });
  const rejectedBookingId = await createBooking(rejected.voucherId, "pending");
  const rejection = await updateAdminBookingStatus(owner, rejectedBookingId, "rejected");
  assert(rejection.success, "Rejected voucher booking was not updated.");
  const [releasedRejected] = await db.select({ status: vouchers.status }).from(vouchers).where(eq(vouchers.id, rejected.voucherId));
  assert(releasedRejected?.status === "active", "Rejected booking did not release voucher.");

  await db.update(vouchers).set({ status: "reserved" }).where(eq(vouchers.id, active.voucherId));
  await createBooking(active.voucherId, "pending");
  await createBooking(active.voucherId, "pending").then(
    () => { throw new Error("A second blocking booking was accepted for one voucher."); },
    () => undefined,
  );

  const expired = await createVoucher({ status: "reserved", expiresAt: new Date(Date.now() - 60_000) });
  await resolveVoucherBookingByToken(expired.bookingToken).then(
    () => { throw new Error("Expired voucher resolved as bookable."); },
    () => undefined,
  );
  await releaseVoucherReservationForBooking({ voucherId: expired.voucherId, actorUsername: owner.username, actorRole: owner.role });
  const [expiredState] = await db.select({ status: vouchers.status }).from(vouchers).where(eq(vouchers.id, expired.voucherId));
  assert(expiredState?.status === "expired", "Expired reservation returned to active.");

  const cancelled = await createVoucher({ status: "cancelled" });
  await resolveVoucherBookingByToken(cancelled.bookingToken).then(
    () => { throw new Error("Cancelled voucher resolved as bookable."); },
    () => undefined,
  );

  const redeemable = await createVoucher({ status: "reserved" });
  const completedBookingId = await createBooking(redeemable.voucherId, "completed");
  const redemption = await redeemAdminVoucher(owner, redeemable.voucherId);
  assert(redemption.success && !redemption.alreadyApplied, "Completed voucher booking was not redeemed.");

  const history = await db.select({ eventType: voucherEvents.eventType }).from(voucherEvents).where(eq(voucherEvents.voucherId, redeemable.voucherId));
  assert(history.some((event) => event.eventType === "redeemed"), "Redemption event was not persisted.");
  const restored = await restoreAdminVoucher(owner, redeemable.voucherId);
  assert(!restored.success && restored.reason === "invalid_transition", "Redeemed voucher was restored despite its completed booking.");

  const specialistRedeemable = await createVoucher({ status: "reserved" });
  const specialistBookingId = await createBooking(specialistRedeemable.voucherId, "completed");
  const specialistRedemption = await redeemVoucherForCompletedBooking(adrian, specialistBookingId);
  assert(specialistRedemption.success && !specialistRedemption.alreadyApplied, "Specialist could not redeem their own completed voucher booking.");

  const foreignRedeemable = await createVoucher({ status: "reserved" });
  const foreignBookingId = await createBooking(foreignRedeemable.voucherId, "completed");
  const foreignRedemption = await redeemVoucherForCompletedBooking(aleksandra, foreignBookingId);
  assert(!foreignRedemption.success && foreignRedemption.reason === "not_found", "Specialist redeemed another specialist's voucher booking.");

  const activeVoucher = await createVoucher();
  const activeRedemption = await redeemAdminVoucher(owner, activeVoucher.voucherId);
  assert(!activeRedemption.success && activeRedemption.reason === "invalid_transition", "Active voucher was redeemed.");

  assert(completedBookingId, "Completed booking fixture was not created.");

  console.info("Voucher reservation lifecycle: token, release, redemption and local row-lock checks OK.");
} finally {
  if (createdBookingIds.length) await db.delete(bookingEvents).where(inArray(bookingEvents.bookingId, createdBookingIds));
  if (createdBookingIds.length) await db.delete(bookings).where(inArray(bookings.id, createdBookingIds));
  if (createdVoucherIds.length) await db.delete(voucherEvents).where(inArray(voucherEvents.voucherId, createdVoucherIds));
  if (createdVoucherIds.length) await db.delete(vouchers).where(inArray(vouchers.id, createdVoucherIds));
  if (createdOrderIds.length) await db.delete(voucherOrderAddons).where(inArray(voucherOrderAddons.voucherOrderId, createdOrderIds));
  if (createdOrderIds.length) await db.delete(voucherOrders).where(inArray(voucherOrders.id, createdOrderIds));
  await db.delete(addons).where(eq(addons.id, addonId));
}
