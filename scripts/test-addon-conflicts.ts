import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "../src/db";
import { addonConflicts, addons, massageAddons, massages } from "../src/db/schema";
import { getAvailableAddonsForMassage, resolveBookingAddons } from "../src/server/bookings/booking-addons.service";
import { getAdminAddonData, saveAdminAddon, setAdminAddonActive } from "../src/server/admin/admin-addons.service";
import type { AdminSession } from "../src/server/admin/admin-auth.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Addon conflict smoke test may run only against local PostgreSQL.");
}

const [massage] = await db.select({ id: massages.id }).from(massages).where(and(eq(massages.isActive, true), eq(massages.bookingAvailable, true))).limit(1);
if (!massage) throw new Error("No bookable massage in local database.");

const rollback = new Error("TEST_ROLLBACK");
const prefix = `addon-conflict-test-${randomUUID()}`;
const ids = ["a", "b", "c", "d", "e", "f"].map((letter) => `${prefix}-${letter}`);
const [a, b, c, d, e, f] = ids;

try {
  await db.transaction(async (tx) => {
    await tx.insert(addons).values(ids.map((id, index) => ({
      id,
      name: `Test ${index}`,
      priceGrosze: index === 2 ? 2500 : 1000,
      slotExtensionMinutes: index === 2 ? 20 : 10,
      isActive: id !== d,
      isConfirmed: id !== e,
    })));
    await tx.insert(massageAddons).values([a, b, c, d, e].map((addonId) => ({ massageId: massage.id, addonId })));

    const valid = await resolveBookingAddons({ massageId: massage.id, addonIds: [a, c], executor: tx });
    assert.equal(valid.totalPriceGrosze, 3500);
    assert.equal(valid.totalSlotExtensionMinutes, 30);
    await assert.rejects(resolveBookingAddons({ massageId: massage.id, addonIds: [a, a], executor: tx }), /BOOKING_ADDONS_DUPLICATE/);
    await assert.rejects(resolveBookingAddons({ massageId: massage.id, addonIds: [a, d], executor: tx }), /BOOKING_ADDONS_UNAVAILABLE/);
    await assert.rejects(resolveBookingAddons({ massageId: massage.id, addonIds: [a, e], executor: tx }), /BOOKING_ADDONS_UNAVAILABLE/);
    await assert.rejects(resolveBookingAddons({ massageId: massage.id, addonIds: [a, f], executor: tx }), /BOOKING_ADDONS_UNAVAILABLE/);

    await tx.insert(addonConflicts).values({ addonAId: a, addonBId: b });
    await assert.rejects(resolveBookingAddons({ massageId: massage.id, addonIds: [a, b], executor: tx }), /BOOKING_ADDONS_CONFLICT/);
    await assert.rejects(resolveBookingAddons({ massageId: massage.id, addonIds: [b, a], executor: tx }), /BOOKING_ADDONS_CONFLICT/);
    const [pair] = await tx.select().from(addonConflicts).where(eq(addonConflicts.addonBId, b));
    assert.equal(pair.addonAId, a);

    await tx.update(addons).set({ isActive: false }).where(eq(addons.id, a));
    assert.equal((await tx.select().from(addonConflicts).where(eq(addonConflicts.addonAId, a))).length, 1);
    await tx.update(addons).set({ isActive: true }).where(eq(addons.id, a));
    await assert.rejects(resolveBookingAddons({ massageId: massage.id, addonIds: [a, b], executor: tx }), /BOOKING_ADDONS_CONFLICT/);

    await assert.rejects(tx.transaction(async (savepoint) => {
      await savepoint.insert(addonConflicts).values({ addonAId: a, addonBId: a });
    }));
    await assert.rejects(tx.transaction(async (savepoint) => {
      await savepoint.insert(addonConflicts).values({ addonAId: b, addonBId: a });
    }));
    await assert.rejects(tx.transaction(async (savepoint) => {
      await savepoint.insert(addonConflicts).values({ addonAId: a, addonBId: b });
    }));
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
}

assert.equal((await db.select().from(addons).where(eq(addons.id, a))).length, 0);
const owner: AdminSession = { username: "addon-local-test", role: "owner", specialistId: null, expiresAt: Date.now() + 60_000 };
const specialist: AdminSession = { ...owner, role: "specialist", specialistId: "adrian" };
const adminDraft = { name: "Test admin conflict", description: "", pricePLN: "10.00", treatmentDurationMinutes: "", slotExtensionMinutes: "0", isActive: true, isConfirmed: true, notes: "", massageIds: [massage.id], conflictingAddonIds: [] as string[] };
const createdIds: string[] = [];
try {
  await assert.rejects(saveAdminAddon(specialist, adminDraft), /ADMIN_OWNER_ACCESS_REQUIRED/);
  const first = await saveAdminAddon(owner, adminDraft);
  createdIds.push(first.id);
  const second = await saveAdminAddon(owner, { ...adminDraft, name: "Test admin conflict 2", conflictingAddonIds: [first.id] });
  createdIds.push(second.id);
  const data = await getAdminAddonData(owner);
  assert.ok(data.addons.find((addon) => addon.id === first.id)?.conflictingAddonIds.includes(second.id));
  assert.ok(data.addons.find((addon) => addon.id === second.id)?.conflictingAddonIds.includes(first.id));
  const publicAddons = await getAvailableAddonsForMassage(massage.id);
  assert.ok(publicAddons.find((addon) => addon.id === first.id)?.conflictingAddonIds.includes(second.id));
  assert.ok(publicAddons.find((addon) => addon.id === second.id)?.conflictingAddonIds.includes(first.id));
  assert.ok(!("notes" in (publicAddons.find((addon) => addon.id === first.id) ?? {})));
  await setAdminAddonActive(owner, first.id, false);
  assert.equal((await db.select().from(addonConflicts).where(or(eq(addonConflicts.addonAId, first.id), eq(addonConflicts.addonBId, first.id)))).length, 1);
  assert.ok(!(await getAvailableAddonsForMassage(massage.id)).some((addon) => addon.id === first.id));
  await setAdminAddonActive(owner, first.id, true);
  await assert.rejects(saveAdminAddon(owner, { ...adminDraft, id: first.id, conflictingAddonIds: [first.id] }), /ADMIN_ADDON_INVALID_INPUT/);
} finally {
  if (createdIds.length) {
    await db.delete(addonConflicts).where(or(inArray(addonConflicts.addonAId, createdIds), inArray(addonConflicts.addonBId, createdIds)));
    await db.delete(massageAddons).where(inArray(massageAddons.addonId, createdIds));
    await db.delete(addons).where(inArray(addons.id, createdIds));
  }
}
console.log("Addon conflicts: service, symmetry, DB constraints and rollback OK.");
process.exit(0);
