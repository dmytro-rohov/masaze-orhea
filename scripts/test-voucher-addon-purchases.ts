import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "../src/db";
import {
  addonConflicts,
  addons,
  massageAddons,
  massageVariants,
  massages,
  voucherOrderAddons,
  voucherOrders,
} from "../src/db/schema";
import { resolveVoucherAddons } from "../src/server/bookings/booking-addons.service";

const databaseUrl = process.env.DATABASE_URL;

if (
  !databaseUrl ||
  !["localhost", "127.0.0.1", "::1"].includes(
    new URL(databaseUrl).hostname,
  )
) {
  throw new Error(
    "Voucher addon smoke test may run only against local PostgreSQL.",
  );
}

const [variant] = await db
  .select({
    massageId: massages.id,
    massageName: massages.name,
    variantId: massageVariants.id,
    durationMinutes: massageVariants.durationMinutes,
    durationLabel: massageVariants.durationLabel,
    bookingSlotMinutes: massageVariants.bookingSlotMinutes,
    priceGrosze: massageVariants.priceGrosze,
  })
  .from(massageVariants)
  .innerJoin(massages, eq(massages.id, massageVariants.massageId))
  .where(
    and(
      eq(massages.isActive, true),
      eq(massages.voucherAvailable, true),
      eq(massageVariants.isActive, true),
    ),
  )
  .limit(1);

if (!variant) {
  throw new Error("No voucher-available massage variant in local database.");
}

const rollback = new Error("TEST_ROLLBACK");
const prefix = `voucher-addon-test-${randomUUID()}`;
const [a, b, c, inactive, unconfirmed, unassigned] = [
  "a",
  "b",
  "c",
  "inactive",
  "unconfirmed",
  "unassigned",
].map((suffix) => `${prefix}-${suffix}`);

try {
  await db.transaction(async (tx) => {
    await tx.insert(addons).values([
      { id: a, name: "Dodatek A", priceGrosze: 1000, slotExtensionMinutes: 10, isActive: true, isConfirmed: true },
      { id: b, name: "Dodatek B", priceGrosze: 1500, slotExtensionMinutes: 15, isActive: true, isConfirmed: true },
      { id: c, name: "Dodatek C", priceGrosze: 2500, slotExtensionMinutes: 20, isActive: true, isConfirmed: true },
      { id: inactive, name: "Nieaktywny", priceGrosze: 1000, slotExtensionMinutes: 0, isActive: false, isConfirmed: true },
      { id: unconfirmed, name: "Niepotwierdzony", priceGrosze: 1000, slotExtensionMinutes: 0, isActive: true, isConfirmed: false },
      { id: unassigned, name: "Nieprzypisany", priceGrosze: 1000, slotExtensionMinutes: 0, isActive: true, isConfirmed: true },
    ]);
    await tx.insert(massageAddons).values([a, b, c, inactive, unconfirmed].map((addonId) => ({
      massageId: variant.massageId,
      addonId,
    })));
    await tx.insert(addonConflicts).values({ addonAId: a, addonBId: b });

    const selected = await resolveVoucherAddons({
      massageId: variant.massageId,
      addonIds: [a, c],
      executor: tx,
    });
    assert.equal(selected.totalPriceGrosze, 3500);
    assert.equal(selected.totalSlotExtensionMinutes, 30);
    await assert.rejects(
      resolveVoucherAddons({ massageId: variant.massageId, addonIds: [a, b], executor: tx }),
      /VOUCHER_ADDONS_CONFLICT/,
    );
    await assert.rejects(
      resolveVoucherAddons({ massageId: variant.massageId, addonIds: [a, a], executor: tx }),
      /VOUCHER_ADDONS_DUPLICATE/,
    );
    for (const addonId of [inactive, unconfirmed, unassigned]) {
      await assert.rejects(
        resolveVoucherAddons({ massageId: variant.massageId, addonIds: [addonId], executor: tx }),
        /VOUCHER_ADDONS_UNAVAILABLE/,
      );
    }

    const [order] = await tx
      .insert(voucherOrders)
      .values({
        voucherType: "service",
        massageId: variant.massageId,
        massageVariantId: variant.variantId,
        massageNameSnapshot: variant.massageName,
        durationMinutesSnapshot: variant.durationMinutes,
        durationLabelSnapshot: variant.durationLabel,
        bookingSlotMinutesSnapshot: variant.bookingSlotMinutes,
        priceGroszeSnapshot: variant.priceGrosze,
        amountGrosze: variant.priceGrosze,
        addonsTotalGrosze: selected.totalPriceGrosze,
        totalAmountGrosze: variant.priceGrosze + selected.totalPriceGrosze,
        buyerFirstName: "Test",
        buyerLastName: "Voucher",
        buyerEmail: "test@example.invalid",
      })
      .returning({ id: voucherOrders.id });

    assert.ok(order);
    await tx.insert(voucherOrderAddons).values(selected.addons.map((addon) => ({
      voucherOrderId: order.id,
      addonId: addon.id,
      nameSnapshot: addon.name,
      descriptionSnapshot: addon.description,
      priceGroszeSnapshot: addon.priceGrosze,
      treatmentDurationMinutesSnapshot: addon.treatmentDurationMinutes,
      slotExtensionMinutesSnapshot: addon.slotExtensionMinutes,
    })));
    await tx.update(addons).set({ priceGrosze: 9999, name: "Zmieniony dodatek" }).where(eq(addons.id, a));
    const [snapshot] = await tx
      .select()
      .from(voucherOrderAddons)
      .where(and(eq(voucherOrderAddons.voucherOrderId, order.id), eq(voucherOrderAddons.addonId, a)));
    assert.equal(snapshot?.nameSnapshot, "Dodatek A");
    assert.equal(snapshot?.priceGroszeSnapshot, 1000);
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
}

console.log("Voucher addons: resolver, conflicts and immutable order snapshots OK.");
