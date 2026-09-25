import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { addons, massageAddons, massages } from "@/db/schema";
import type { AdminSession } from "./admin-auth.service";
import { isOwner } from "./admin-authorization.service";

const assertOwner = (session: AdminSession) => {
  if (!isOwner(session)) throw new Error("ADMIN_OWNER_ACCESS_REQUIRED");
};

export const getAdminAddonData = async (session: AdminSession) => {
  assertOwner(session);
  const [addonRows, assignments, massageRows] = await Promise.all([
    db.select().from(addons).orderBy(asc(addons.name)),
    db.select().from(massageAddons),
    db
      .select({ id: massages.id, name: massages.name })
      .from(massages)
      .orderBy(asc(massages.name)),
  ]);
  return {
    addons: addonRows.map((addon) => ({
      ...addon,
      massageIds: assignments
        .filter((row) => row.addonId === addon.id)
        .map((row) => row.massageId),
    })),
    massages: massageRows,
  };
};

export type AdminAddonInput = {
  id?: string;
  name: string;
  description: string;
  pricePLN: string;
  treatmentDurationMinutes: string;
  slotExtensionMinutes: string;
  isActive: boolean;
  isConfirmed: boolean;
  notes: string;
  massageIds: string[];
};

const parsePrice = (value: string): number => {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(normalized))
    throw new Error("ADMIN_ADDON_INVALID_INPUT");
  return Math.round(Number(normalized) * 100);
};

const parseMinutes = (value: string, min: number): number | null => {
  if (value.trim() === "" && min === 1) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > 480)
    throw new Error("ADMIN_ADDON_INVALID_INPUT");
  return parsed;
};

export const saveAdminAddon = async (
  session: AdminSession,
  input: AdminAddonInput,
) => {
  assertOwner(session);
  const name = input.name.trim();
  const description = input.description.trim() || null;
  const notes = input.notes.trim() || null;
  if (
    name.length < 2 ||
    name.length > 120 ||
    (description?.length ?? 0) > 1000 ||
    (notes?.length ?? 0) > 4000 ||
    input.massageIds.length > 100 ||
    new Set(input.massageIds).size !== input.massageIds.length ||
    input.massageIds.some((id) => !id || id.length > 100)
  ) {
    throw new Error("ADMIN_ADDON_INVALID_INPUT");
  }
  const priceGrosze = parsePrice(input.pricePLN);
  const treatmentDurationMinutes = parseMinutes(
    input.treatmentDurationMinutes,
    1,
  );
  const slotExtensionMinutes = parseMinutes(input.slotExtensionMinutes, 0);
  if (slotExtensionMinutes === null)
    throw new Error("ADMIN_ADDON_INVALID_INPUT");
  const id = input.id ?? crypto.randomUUID();

  return db.transaction(async (tx) => {
    if (input.id) {
      const [existing] = await tx
        .select({ id: addons.id })
        .from(addons)
        .where(eq(addons.id, id))
        .for("update");
      if (!existing) throw new Error("ADMIN_ADDON_NOT_FOUND");
    }
    if (input.massageIds.length) {
      const valid = await tx
        .select({ id: massages.id })
        .from(massages)
        .where(inArray(massages.id, input.massageIds));
      if (valid.length !== input.massageIds.length)
        throw new Error("ADMIN_ADDON_INVALID_MASSAGE");
    }
    const values = {
      name,
      description,
      notes,
      priceGrosze,
      treatmentDurationMinutes,
      slotExtensionMinutes,
      isActive: input.isActive,
      isConfirmed: input.isConfirmed,
      updatedAt: new Date(),
    };
    if (input.id) await tx.update(addons).set(values).where(eq(addons.id, id));
    else await tx.insert(addons).values({ id, ...values });
    await tx.delete(massageAddons).where(eq(massageAddons.addonId, id));
    if (input.massageIds.length) {
      await tx
        .insert(massageAddons)
        .values(
          input.massageIds.map((massageId) => ({ addonId: id, massageId })),
        );
    }
    return { id };
  });
};

export const setAdminAddonActive = async (
  session: AdminSession,
  id: string,
  isActive: boolean,
) => {
  assertOwner(session);
  if (!id || id.length > 100) throw new Error("ADMIN_ADDON_INVALID_INPUT");
  const [row] = await db
    .update(addons)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(addons.id, id))
    .returning({ id: addons.id });
  if (!row) throw new Error("ADMIN_ADDON_NOT_FOUND");
  return row;
};
