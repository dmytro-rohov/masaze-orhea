import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import {
  addonConflicts,
  addons,
  massageAddons,
  massages,
} from "../src/db/schema";
import {
  getCurrentVoucherExtraAddonsForMassage,
  resolveVoucherExtraAddons,
} from "../src/server/bookings/booking-addons.service";

const databaseUrl = process.env.DATABASE_URL;

if (
  !databaseUrl ||
  !["localhost", "127.0.0.1", "::1"].includes(
    new URL(databaseUrl).hostname,
  )
) {
  throw new Error(
    "Voucher extra addon smoke test may run only against local PostgreSQL.",
  );
}

const [massage] = await db
  .select({ id: massages.id })
  .from(massages)
  .where(eq(massages.isActive, true))
  .limit(1);

if (!massage) throw new Error("No active massage in local database.");

const rollback = new Error("TEST_ROLLBACK");
const prefix = `voucher-extra-addon-test-${randomUUID()}`;
const [included, compatible, conflicting, inactive, unconfirmed, unassigned] = [
  "included",
  "compatible",
  "conflicting",
  "inactive",
  "unconfirmed",
  "unassigned",
].map((suffix) => `${prefix}-${suffix}`);

try {
  await db.transaction(async (tx) => {
    await tx.insert(addons).values([
      {
        id: included,
        name: "Objęty voucherem",
        priceGrosze: 1000,
        treatmentDurationMinutes: 10,
        slotExtensionMinutes: 10,
        isActive: true,
        isConfirmed: true,
      },
      {
        id: compatible,
        name: "Kompatybilny dodatkowy",
        priceGrosze: 2500,
        treatmentDurationMinutes: 20,
        slotExtensionMinutes: 20,
        isActive: true,
        isConfirmed: true,
      },
      {
        id: conflicting,
        name: "Konfliktujący dodatkowy",
        priceGrosze: 3000,
        treatmentDurationMinutes: 15,
        slotExtensionMinutes: 15,
        isActive: true,
        isConfirmed: true,
      },
      {
        id: inactive,
        name: "Nieaktywny dodatkowy",
        priceGrosze: 1000,
        slotExtensionMinutes: 0,
        isActive: false,
        isConfirmed: true,
      },
      {
        id: unconfirmed,
        name: "Niepotwierdzony dodatkowy",
        priceGrosze: 1000,
        slotExtensionMinutes: 0,
        isActive: true,
        isConfirmed: false,
      },
      {
        id: unassigned,
        name: "Nieprzypisany dodatkowy",
        priceGrosze: 1000,
        slotExtensionMinutes: 0,
        isActive: true,
        isConfirmed: true,
      },
    ]);
    await tx.insert(massageAddons).values(
      [included, compatible, conflicting, inactive, unconfirmed].map(
        (addonId) => ({ massageId: massage.id, addonId }),
      ),
    );
    const [addonAId, addonBId] = [included, conflicting].sort();
    await tx.insert(addonConflicts).values({ addonAId, addonBId });

    const none = await resolveVoucherExtraAddons({
      massageId: massage.id,
      includedAddonIds: [included],
      addonIds: [],
      executor: tx,
    });
    assert.equal(none.totalPriceGrosze, 0);
    assert.equal(none.totalSlotExtensionMinutes, 0);

    const selected = await resolveVoucherExtraAddons({
      massageId: massage.id,
      includedAddonIds: [included],
      addonIds: [compatible],
      executor: tx,
    });
    assert.equal(selected.totalPriceGrosze, 2500);
    assert.equal(selected.totalSlotExtensionMinutes, 20);
    assert.equal(selected.totalTreatmentDurationMinutes, 20);

    await assert.rejects(
      resolveVoucherExtraAddons({
        massageId: massage.id,
        includedAddonIds: [included],
        addonIds: [included],
        executor: tx,
      }),
      /VOUCHER_EXTRA_ADDONS_DUPLICATE/,
    );
    await assert.rejects(
      resolveVoucherExtraAddons({
        massageId: massage.id,
        includedAddonIds: [included],
        addonIds: [conflicting],
        executor: tx,
      }),
      /VOUCHER_EXTRA_ADDONS_CONFLICT/,
    );
    await assert.rejects(
      resolveVoucherExtraAddons({
        massageId: massage.id,
        includedAddonIds: [included],
        addonIds: [compatible, compatible],
        executor: tx,
      }),
      /VOUCHER_EXTRA_ADDONS_DUPLICATE/,
    );
    for (const addonId of [inactive, unconfirmed, unassigned]) {
      await assert.rejects(
        resolveVoucherExtraAddons({
          massageId: massage.id,
          includedAddonIds: [included],
          addonIds: [addonId],
          executor: tx,
        }),
        /VOUCHER_EXTRA_ADDONS_UNAVAILABLE/,
      );
    }

    const options = await getCurrentVoucherExtraAddonsForMassage({
      massageId: massage.id,
      includedAddonIds: [included],
      executor: tx,
    });
    assert.ok(!options.some((addon) => addon.id === included));
    assert.ok(options.some((addon) => addon.id === compatible));
    assert.ok(
      options
        .find((addon) => addon.id === conflicting)
        ?.conflictingAddonIds.includes(included),
    );

    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
}

console.log(
  "Voucher extra addons: union validation, pricing and slot extension OK.",
);
