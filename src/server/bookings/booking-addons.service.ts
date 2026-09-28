import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "../../db";
import { addonConflicts, addons, massageAddons, massages } from "../../db/schema";

export const MAX_BOOKING_ADDONS = 12;
export const MAX_VOUCHER_ADDONS = MAX_BOOKING_ADDONS;

type AddonSelectionPurpose = "booking" | "voucher";

type BookingAddonRow = {
  id: string;
  name: string;
  description: string | null;
  priceGrosze: number | null;
  treatmentDurationMinutes: number | null;
  slotExtensionMinutes: number;
};

export type PublicBookingAddon = {
  id: string;
  name: string;
  description: string | null;
  priceGrosze: number;
  treatmentDurationMinutes: number | null;
  slotExtensionMinutes: number;
  conflictingAddonIds: string[];
};

const publicAddonSelection = {
  id: addons.id,
  name: addons.name,
  description: addons.description,
  priceGrosze: addons.priceGrosze,
  treatmentDurationMinutes: addons.treatmentDurationMinutes,
  slotExtensionMinutes: addons.slotExtensionMinutes,
};

const publiclyAvailableAddon = and(
  eq(addons.isActive, true),
  eq(addons.isConfirmed, true),
  isNotNull(addons.priceGrosze),
  sql`length(btrim(${addons.name})) > 0`,
);

type AddonQueryExecutor = Pick<typeof db, "select">;

const assertMassageAvailableForAddons = async (
  massageId: string,
  purpose: AddonSelectionPurpose,
  executor: AddonQueryExecutor = db,
) => {
  const [massage] = await executor
    .select({ id: massages.id })
    .from(massages)
    .where(
      and(
        eq(massages.id, massageId),
        eq(massages.isActive, true),
        purpose === "booking"
          ? eq(massages.bookingAvailable, true)
          : eq(massages.voucherAvailable, true),
      ),
    )
    .limit(1);

  if (!massage) {
    throw new Error(
      purpose === "booking"
        ? "BOOKING_ADDON_MASSAGE_NOT_FOUND"
        : "VOUCHER_ADDON_MASSAGE_NOT_FOUND",
    );
  }
};

const toPublicAddon = (row: BookingAddonRow, conflictingAddonIds: string[] = []): PublicBookingAddon => {
  // The query excludes draft rows with no price. Keep the runtime guard as a
  // defence against future query changes before adding amounts together.
  if (row.priceGrosze === null) {
    throw new Error("BOOKING_ADDON_INVALID_CONFIGURATION");
  }

  return { ...row, priceGrosze: row.priceGrosze, conflictingAddonIds };
};

const getConflictsForIds = async (ids: string[], executor: AddonQueryExecutor) =>
  ids.length < 2 ? [] : executor
    .select({ addonAId: addonConflicts.addonAId, addonBId: addonConflicts.addonBId })
    .from(addonConflicts)
    .where(and(inArray(addonConflicts.addonAId, ids), inArray(addonConflicts.addonBId, ids)));

const resolveCurrentAddonsWithoutMassageAvailability = async ({
  massageId,
  addonIds,
  includedAddonIds = [],
  executor = db,
}: {
  massageId: string;
  addonIds: unknown;
  includedAddonIds?: string[];
  executor?: AddonQueryExecutor;
}) => {
  if (
    !Array.isArray(addonIds) ||
    addonIds.length > MAX_BOOKING_ADDONS ||
    !addonIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 100)
  ) {
    throw new Error("VOUCHER_EXTRA_ADDONS_INVALID_INPUT");
  }
  if (new Set(addonIds).size !== addonIds.length) {
    throw new Error("VOUCHER_EXTRA_ADDONS_DUPLICATE");
  }
  if (addonIds.some((id) => includedAddonIds.includes(id))) {
    throw new Error("VOUCHER_EXTRA_ADDONS_DUPLICATE");
  }

  const rows = addonIds.length === 0
    ? []
    : await executor
        .select(publicAddonSelection)
        .from(massageAddons)
        .innerJoin(addons, eq(massageAddons.addonId, addons.id))
        .where(and(
          eq(massageAddons.massageId, massageId),
          inArray(addons.id, addonIds),
          publiclyAvailableAddon,
        ));
  if (rows.length !== addonIds.length) {
    throw new Error("VOUCHER_EXTRA_ADDONS_UNAVAILABLE");
  }

  const unionIds = [...includedAddonIds, ...addonIds];
  if ((await getConflictsForIds(unionIds, executor)).length > 0) {
    throw new Error("VOUCHER_EXTRA_ADDONS_CONFLICT");
  }

  const rowsById = new Map(rows.map((row) => [row.id, toPublicAddon(row)]));
  const selectedAddons = addonIds.map((id) => {
    const addon = rowsById.get(id);
    if (!addon) throw new Error("VOUCHER_EXTRA_ADDONS_UNAVAILABLE");
    return addon;
  });
  return {
    addons: selectedAddons,
    totalPriceGrosze: selectedAddons.reduce((sum, addon) => sum + addon.priceGrosze, 0),
    totalSlotExtensionMinutes: selectedAddons.reduce((sum, addon) => sum + addon.slotExtensionMinutes, 0),
    totalTreatmentDurationMinutes: selectedAddons.reduce((sum, addon) => sum + (addon.treatmentDurationMinutes ?? 0), 0),
  };
};

export const getCurrentVoucherExtraAddonsForMassage = async ({
  massageId,
  includedAddonIds = [],
  executor = db,
}: {
  massageId: string;
  includedAddonIds?: string[];
  executor?: AddonQueryExecutor;
}): Promise<PublicBookingAddon[]> => {
  const rows = await executor
    .select(publicAddonSelection)
    .from(massageAddons)
    .innerJoin(addons, eq(massageAddons.addonId, addons.id))
    .where(and(eq(massageAddons.massageId, massageId), publiclyAvailableAddon))
    .orderBy(addons.name, addons.id);
  const allIds = [...new Set([...rows.map((row) => row.id), ...includedAddonIds])];
  const conflicts = await getConflictsForIds(allIds, executor);
  return rows
    .filter((row) => !includedAddonIds.includes(row.id))
    .map((row) => toPublicAddon(row, conflicts.flatMap((pair) =>
      pair.addonAId === row.id ? [pair.addonBId] : pair.addonBId === row.id ? [pair.addonAId] : [],
    )));
};

export const getAvailableAddonsForMassage = async (
  massageId: string,
  purpose: AddonSelectionPurpose = "booking",
): Promise<PublicBookingAddon[]> => {
  await assertMassageAvailableForAddons(massageId, purpose);

  const rows = await db
    .select(publicAddonSelection)
    .from(massageAddons)
    .innerJoin(addons, eq(massageAddons.addonId, addons.id))
    .where(and(eq(massageAddons.massageId, massageId), publiclyAvailableAddon))
    .orderBy(addons.name, addons.id);

  const conflicts = await getConflictsForIds(rows.map((row) => row.id), db);
  return rows.map((row) => toPublicAddon(row, conflicts.flatMap((pair) =>
    pair.addonAId === row.id ? [pair.addonBId] : pair.addonBId === row.id ? [pair.addonAId] : [],
  )));
};

const resolveAddonsForMassage = async ({
  massageId,
  addonIds,
  purpose,
  errorPrefix,
  executor = db,
}: {
  massageId: string;
  addonIds: unknown;
  purpose: AddonSelectionPurpose;
  errorPrefix: "BOOKING" | "VOUCHER";
  executor?: AddonQueryExecutor;
}) => {
  if (
    !Array.isArray(addonIds) ||
    addonIds.length > MAX_BOOKING_ADDONS ||
    !addonIds.every(
      (id) => typeof id === "string" && id.length > 0 && id.length <= 100,
    )
  ) {
    throw new Error(`${errorPrefix}_ADDONS_INVALID_INPUT`);
  }

  // Reject duplicates instead of silently changing the customer's selection.
  if (new Set(addonIds).size !== addonIds.length) {
    throw new Error(`${errorPrefix}_ADDONS_DUPLICATE`);
  }

  await assertMassageAvailableForAddons(massageId, purpose, executor);

  const rows =
    addonIds.length === 0
      ? []
      : await executor
          .select(publicAddonSelection)
          .from(massageAddons)
          .innerJoin(addons, eq(massageAddons.addonId, addons.id))
          .where(
            and(
              eq(massageAddons.massageId, massageId),
              inArray(addons.id, addonIds),
              publiclyAvailableAddon,
            ),
          );

  if (rows.length !== addonIds.length) {
    throw new Error(`${errorPrefix}_ADDONS_UNAVAILABLE`);
  }

  if ((await getConflictsForIds(addonIds, executor)).length > 0) {
    throw new Error(`${errorPrefix}_ADDONS_CONFLICT`);
  }

  const rowsById = new Map(rows.map((row) => [row.id, toPublicAddon(row)]));
  const selectedAddons = addonIds.map((id: string) => {
    const addon = rowsById.get(id);
    if (!addon) {
      throw new Error(`${errorPrefix}_ADDONS_UNAVAILABLE`);
    }
    return addon;
  });

  return {
    addons: selectedAddons,
    totalPriceGrosze: selectedAddons.reduce(
      (sum, addon) => sum + addon.priceGrosze,
      0,
    ),
    totalSlotExtensionMinutes: selectedAddons.reduce(
      (sum, addon) => sum + addon.slotExtensionMinutes,
      0,
    ),
    totalTreatmentDurationMinutes: selectedAddons.reduce(
      (sum, addon) => sum + (addon.treatmentDurationMinutes ?? 0),
      0,
    ),
  };
};

export const resolveBookingAddons = (input: {
  massageId: string;
  addonIds: unknown;
  executor?: AddonQueryExecutor;
}) =>
  resolveAddonsForMassage({
    ...input,
    purpose: "booking",
    errorPrefix: "BOOKING",
  });

export const resolveVoucherAddons = (input: {
  massageId: string;
  addonIds: unknown;
  executor?: AddonQueryExecutor;
}) =>
  resolveAddonsForMassage({
    ...input,
    purpose: "voucher",
    errorPrefix: "VOUCHER",
  });

/** Current catalogue extras selected while redeeming a historical voucher. */
export const resolveVoucherExtraAddons = resolveCurrentAddonsWithoutMassageAvailability;
