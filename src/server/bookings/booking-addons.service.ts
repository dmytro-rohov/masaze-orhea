import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "../../db";
import { addons, massageAddons, massages } from "../../db/schema";

export const MAX_BOOKING_ADDONS = 12;

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

const assertBookingMassageAvailable = async (
  massageId: string,
  executor: AddonQueryExecutor = db,
) => {
  const [massage] = await executor
    .select({ id: massages.id })
    .from(massages)
    .where(
      and(
        eq(massages.id, massageId),
        eq(massages.isActive, true),
        eq(massages.bookingAvailable, true),
      ),
    )
    .limit(1);

  if (!massage) {
    throw new Error("BOOKING_ADDON_MASSAGE_NOT_FOUND");
  }
};

const toPublicAddon = (row: BookingAddonRow): PublicBookingAddon => {
  // The query excludes draft rows with no price. Keep the runtime guard as a
  // defence against future query changes before adding amounts together.
  if (row.priceGrosze === null) {
    throw new Error("BOOKING_ADDON_INVALID_CONFIGURATION");
  }

  return { ...row, priceGrosze: row.priceGrosze };
};

export const getAvailableAddonsForMassage = async (
  massageId: string,
): Promise<PublicBookingAddon[]> => {
  await assertBookingMassageAvailable(massageId);

  const rows = await db
    .select(publicAddonSelection)
    .from(massageAddons)
    .innerJoin(addons, eq(massageAddons.addonId, addons.id))
    .where(and(eq(massageAddons.massageId, massageId), publiclyAvailableAddon))
    .orderBy(addons.name, addons.id);

  return rows.map(toPublicAddon);
};

export const resolveBookingAddons = async ({
  massageId,
  addonIds,
  executor = db,
}: {
  massageId: string;
  addonIds: unknown;
  executor?: AddonQueryExecutor;
}) => {
  if (
    !Array.isArray(addonIds) ||
    addonIds.length > MAX_BOOKING_ADDONS ||
    !addonIds.every(
      (id) => typeof id === "string" && id.length > 0 && id.length <= 100,
    )
  ) {
    throw new Error("BOOKING_ADDONS_INVALID_INPUT");
  }

  // Reject duplicates instead of silently changing the customer's selection.
  if (new Set(addonIds).size !== addonIds.length) {
    throw new Error("BOOKING_ADDONS_DUPLICATE");
  }

  await assertBookingMassageAvailable(massageId, executor);

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
    throw new Error("BOOKING_ADDONS_UNAVAILABLE");
  }

  const rowsById = new Map(rows.map((row) => [row.id, toPublicAddon(row)]));
  const selectedAddons = addonIds.map((id: string) => {
    const addon = rowsById.get(id);
    if (!addon) {
      throw new Error("BOOKING_ADDONS_UNAVAILABLE");
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
