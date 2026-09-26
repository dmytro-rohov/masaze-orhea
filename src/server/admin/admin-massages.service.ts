import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { massageContent, massages, massageVariants } from "@/db/schema";
import { isMassageZoneId, massageZoneDefinitions } from "@/data/massage-zones";
import { massageBodyVisualKeys, massageVisualKeys } from "@/data/massage-visual-keys";
import type { AdminSession } from "./admin-auth.service";
import { isOwner } from "./admin-authorization.service";

const fail = (code: string): never => { throw new Error(code); };
const owner = (session: AdminSession) => { if (!isOwner(session)) fail("ADMIN_OWNER_ACCESS_REQUIRED"); };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number, required = false): string => {
  if (typeof value !== "string") fail("ADMIN_MASSAGE_INVALID_INPUT");
  const result = (value as string).trim();
  if (result.length > max || (required && !result)) fail("ADMIN_MASSAGE_INVALID_INPUT");
  return result;
};
const integer = (value: unknown, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) fail("ADMIN_MASSAGE_INVALID_INPUT");
  return value as number;
};
const stringList = (value: unknown, limit: number, itemMax: number, unique = false): string[] => {
  if (!Array.isArray(value) || value.length > limit) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const items = (value as unknown[]).map((item) => text(item, itemMax, true));
  if (unique && new Set(items.map((item) => item.toLocaleLowerCase("pl"))).size !== items.length) fail("ADMIN_MASSAGE_INVALID_INPUT");
  return items;
};
const money = (value: unknown): number => {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,5})(?:[.,]\d{1,2})?$/.test(value.trim())) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const [whole, fraction = ""] = (value as string).trim().replace(",", ".").split(".");
  const grosze = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (grosze > 1_000_000) fail("ADMIN_MASSAGE_INVALID_INPUT");
  return grosze;
};

const parseDraft = (input: unknown) => {
  if (!record(input)) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const payload = input as Record<string, unknown>;
  if (!record(payload.core) || !record(payload.content) || !Array.isArray(payload.variants)) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const core = payload.core as Record<string, unknown>;
  const title = text(core.title, 160, true);
  const serviceName = text(core.serviceName ?? "", 160) || null;
  const slug = text(core.slug, 160, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail("ADMIN_MASSAGE_INVALID_SLUG");
  const zoneId = text(core.zoneId, 40, true);
  if (!isMassageZoneId(zoneId)) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const visualKey = text(core.visualKey, 100, true);
  if (!massageVisualKeys.includes(visualKey)) fail("ADMIN_MASSAGE_INVALID_INPUT");
  if (typeof core.isActive !== "boolean" || typeof core.bookingAvailable !== "boolean" || typeof core.voucherAvailable !== "boolean") fail("ADMIN_MASSAGE_INVALID_INPUT");
  const isActive = core.isActive as boolean;
  const base = {
    name: serviceName ? `${title} — ${serviceName}` : title,
    title, serviceName, slug, zoneId,
    shortDescription: text(core.shortDescription, 2000, true),
    labels: stringList(core.labels, 12, 80, true),
    sortOrder: integer(core.sortOrder, 0, 100000),
    visualKey,
    isActive,
    bookingAvailable: isActive && (core.bookingAvailable as boolean),
    voucherAvailable: isActive && (core.voucherAvailable as boolean),
  };
  const variantInput = payload.variants as unknown[];
  if (variantInput.length < 1 || variantInput.length > 20) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const variants = variantInput.map((item) => {
    const raw = item as Record<string, unknown>;
    if (!record(raw)) fail("ADMIN_MASSAGE_INVALID_INPUT");
    const code = text(raw.code, 80, true);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) fail("ADMIN_MASSAGE_INVALID_INPUT");
    const durationMinutes = raw.durationMinutes === null || raw.durationMinutes === "" ? null : integer(raw.durationMinutes, 1, 1440);
    const durationLabel = text(raw.durationLabel ?? "", 160) || null;
    if (durationMinutes === null && !durationLabel) fail("ADMIN_MASSAGE_INVALID_INPUT");
    if (typeof raw.isActive !== "boolean") fail("ADMIN_MASSAGE_INVALID_INPUT");
    return {
      id: raw.id ? text(raw.id, 36, true) : undefined,
      code,
      durationMinutes,
      durationLabel,
      bookingSlotMinutes: integer(raw.bookingSlotMinutes, 1, 1440),
      priceGrosze: money(raw.pricePLN),
      isActive: raw.isActive as boolean,
      sortOrder: integer(raw.sortOrder, 0, 100000),
    };
  });
  if (new Set(variants.map((item) => item.code)).size !== variants.length ||
    new Set(variants.filter((item) => item.id).map((item) => item.id)).size !== variants.filter((item) => item.id).length) fail("ADMIN_MASSAGE_INVALID_INPUT");
  if (base.isActive && (base.bookingAvailable || base.voucherAvailable) && !variants.some((item) => item.isActive)) fail("ADMIN_MASSAGE_NO_ACTIVE_VARIANT");

  const content = payload.content as Record<string, unknown>;
  const descriptionRaw = content.description;
  if (!Array.isArray(descriptionRaw) || descriptionRaw.length < 1 || descriptionRaw.length > 20) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const description = (descriptionRaw as unknown[]).map((section) => {
    if (!record(section)) fail("ADMIN_MASSAGE_INVALID_INPUT");
    const row = section as Record<string, unknown>;
    const paragraphs = stringList(row.paragraphs, 12, 5000);
    if (!paragraphs.length) fail("ADMIN_MASSAGE_INVALID_INPUT");
    return { title: text(row.title ?? "", 160) || undefined, paragraphs };
  });
  const parseList = (value: unknown) => {
    if (!record(value)) fail("ADMIN_MASSAGE_INVALID_INPUT");
    const row = value as Record<string, unknown>;
    return { title: text(row.title, 160, true), items: stringList(row.items, 30, 1000) };
  };
  const parseBlock = (value: unknown) => {
    if (!record(value)) fail("ADMIN_MASSAGE_INVALID_INPUT");
    const row = value as Record<string, unknown>;
    return { title: text(row.title, 160, true), description: text(row.description, 5000, true) };
  };
  const stepsRaw = content.steps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length > 30) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const steps = (stepsRaw as unknown[]).map((step) => {
    if (!record(step)) fail("ADMIN_MASSAGE_INVALID_INPUT");
    const row = step as Record<string, unknown>;
    return { id: text(row.id, 80, true), label: text(row.label, 200, true), durationLabel: text(row.durationLabel ?? "", 160) || undefined, description: text(row.description, 2000, true) };
  });
  if (new Set(steps.map((step) => step.id)).size !== steps.length) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const bodyVisualKey = text(content.bodyVisualKey ?? "", 100) || null;
  if (bodyVisualKey && !massageBodyVisualKeys.some((key) => key === bodyVisualKey)) fail("ADMIN_MASSAGE_INVALID_INPUT");
  const relatedLimit = integer(content.relatedLimit ?? 3, 0, 6);
  const relatedMassageIds = stringList(content.relatedMassageIds, 6, 100, true);
  if (relatedMassageIds.length > relatedLimit) fail("ADMIN_MASSAGE_INVALID_RELATED");
  return {
    core: base,
    variants,
    content: {
      tagline: text(content.tagline ?? "", 300) || null,
      description,
      bodyVisualKey,
      bodyVisualAlt: text(content.bodyVisualAlt ?? "", 300) || null,
      forWhom: parseList(content.forWhom),
      expectations: parseList(content.expectations),
      safety: parseBlock(content.safety),
      steps: steps.length ? steps : null,
      bookingCta: parseBlock(content.bookingCta),
      seoPhrases: stringList(content.seoPhrases, 30, 160, true),
      relatedMassageIds,
      relatedLimit,
    },
  };
};

export const getAdminMassageList = async (session: AdminSession) => {
  owner(session);
  const [rows, variants] = await Promise.all([
    db.select().from(massages).orderBy(asc(massages.sortOrder), asc(massages.title)),
    db.select().from(massageVariants),
  ]);
  return rows.map((massage) => ({
    ...massage,
    variants: variants.filter((variant) => variant.massageId === massage.id),
  }));
};

export const getAdminMassageEditor = async (session: AdminSession, id: string) => {
  owner(session);
  const [massage] = await db.select().from(massages).where(eq(massages.id, id)).limit(1);
  if (!massage) return null;
  const [variants, contents, related] = await Promise.all([
    db.select().from(massageVariants).where(eq(massageVariants.massageId, id)).orderBy(asc(massageVariants.sortOrder), asc(massageVariants.code)),
    db.select().from(massageContent).where(eq(massageContent.massageId, id)).limit(1),
    db.select({ id: massages.id, title: massages.title }).from(massages).where(ne(massages.id, id)).orderBy(asc(massages.title)),
  ]);
  return { massage, variants, content: contents[0] ?? null, related };
};

export const getAdminMassageCreateOptions = async (session: AdminSession) => {
  owner(session);
  return {
    zones: massageZoneDefinitions,
    visualKeys: massageVisualKeys,
    bodyVisualKeys: massageBodyVisualKeys,
    related: await db.select({ id: massages.id, title: massages.title }).from(massages).orderBy(asc(massages.title)),
  };
};

export const saveAdminMassage = async (session: AdminSession, input: unknown, editId?: string) => {
  owner(session);
  const draft = parseDraft(input);
  const id = editId ?? draft.core.slug;
  // The existing VIP presentation is tailored to this single code-owned ritual.
  if ((draft.core.zoneId === "vip" && id !== "vip-ritual") || (id === "vip-ritual" && draft.core.zoneId !== "vip")) fail("ADMIN_MASSAGE_VIP_RESERVED");
  if (draft.core.zoneId === "vip" && draft.core.isActive && !draft.content.steps?.length) fail("ADMIN_MASSAGE_VIP_STEPS_REQUIRED");
  if (draft.content.relatedMassageIds.includes(id)) fail("ADMIN_MASSAGE_INVALID_RELATED");
  return db.transaction(async (tx) => {
    // Serializes VIP activation/creation across all massages.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('orhea:massage-cms:vip'))`);
    const now = new Date();
    const [existing] = editId ? await tx.select().from(massages).where(eq(massages.id, id)).for("update").limit(1) : [];
    if (editId && !existing) fail("ADMIN_MASSAGE_NOT_FOUND");
    if (!editId) {
      const [sameId] = await tx.select({ id: massages.id }).from(massages).where(eq(massages.id, id)).limit(1);
      if (sameId) fail("ADMIN_MASSAGE_SLUG_TAKEN");
    }
    const [sameSlug] = await tx.select({ id: massages.id }).from(massages).where(eq(massages.slug, draft.core.slug)).limit(1);
    if (sameSlug && sameSlug.id !== id) fail("ADMIN_MASSAGE_SLUG_TAKEN");
    if (draft.core.isActive && draft.core.zoneId === "vip") {
      const [activeVip] = await tx.select({ id: massages.id }).from(massages).where(and(eq(massages.zoneId, "vip"), eq(massages.isActive, true), ne(massages.id, id))).limit(1);
      if (activeVip) fail("ADMIN_MASSAGE_VIP_EXISTS");
    }
    if (draft.content.relatedMassageIds.length) {
      const related = await tx.select({ id: massages.id }).from(massages).where(inArray(massages.id, draft.content.relatedMassageIds));
      if (related.length !== draft.content.relatedMassageIds.length) fail("ADMIN_MASSAGE_INVALID_RELATED");
    }
    if (editId) await tx.update(massages).set({ ...draft.core, updatedAt: now }).where(eq(massages.id, id));
    else await tx.insert(massages).values({ id, ...draft.core, updatedAt: now });
    await tx.insert(massageContent).values({ massageId: id, ...draft.content, updatedAt: now })
      .onConflictDoUpdate({ target: massageContent.massageId, set: { ...draft.content, updatedAt: now } });
    const oldVariants = editId ? await tx.select().from(massageVariants).where(eq(massageVariants.massageId, id)).for("update") : [];
    if (oldVariants.some((old) => !draft.variants.some((item) => item.id === old.id))) fail("ADMIN_MASSAGE_VARIANT_REMOVAL_FORBIDDEN");
    for (const variant of draft.variants) {
      if (variant.id) {
        const old = oldVariants.find((item) => item.id === variant.id);
        if (!old || old.code !== variant.code) fail("ADMIN_MASSAGE_VARIANT_CODE_IMMUTABLE");
        await tx.update(massageVariants).set({ code: variant.code, durationMinutes: variant.durationMinutes, durationLabel: variant.durationLabel, bookingSlotMinutes: variant.bookingSlotMinutes, priceGrosze: variant.priceGrosze, isActive: variant.isActive, sortOrder: variant.sortOrder, updatedAt: now }).where(eq(massageVariants.id, variant.id));
      } else {
        await tx.insert(massageVariants).values({ massageId: id, code: variant.code, durationMinutes: variant.durationMinutes, durationLabel: variant.durationLabel, bookingSlotMinutes: variant.bookingSlotMinutes, priceGrosze: variant.priceGrosze, isActive: variant.isActive, sortOrder: variant.sortOrder, updatedAt: now });
      }
    }
    if (!editId || existing?.zoneId !== draft.core.zoneId || existing?.sortOrder !== draft.core.sortOrder) {
      const reorder = async (zoneId: string, insertedId?: string, requestedPosition = 0) => {
        const zoneRows = await tx.select({ id: massages.id }).from(massages)
          .where(eq(massages.zoneId, zoneId))
          .orderBy(asc(massages.sortOrder), asc(massages.id));
        const ids = zoneRows.map((row) => row.id).filter((rowId) => rowId !== insertedId);
        if (insertedId) ids.splice(Math.min(requestedPosition, ids.length), 0, insertedId);
        for (const [position, massageId] of ids.entries()) {
          await tx.update(massages).set({ sortOrder: position }).where(eq(massages.id, massageId));
        }
      };
      if (existing && existing.zoneId !== draft.core.zoneId) await reorder(existing.zoneId);
      await reorder(draft.core.zoneId, id, draft.core.sortOrder);
    }
    return { id };
  });
};

export const setAdminMassageActive = async (session: AdminSession, id: string, active: boolean) => {
  owner(session);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('orhea:massage-cms:vip'))`);
    const [massage] = await tx.select().from(massages).where(eq(massages.id, id)).for("update").limit(1);
    if (!massage) fail("ADMIN_MASSAGE_NOT_FOUND");
    if (massage.isActive === active) return { id, alreadyApplied: true };
    if (active) {
      if (massage.zoneId === "vip" && id !== "vip-ritual") fail("ADMIN_MASSAGE_VIP_RESERVED");
      const [content] = await tx.select().from(massageContent).where(eq(massageContent.massageId, id)).limit(1);
      const variants = await tx.select().from(massageVariants).where(eq(massageVariants.massageId, id));
      if (!content || !variants.some((variant) => variant.isActive) || !isMassageZoneId(massage.zoneId) || !massageVisualKeys.includes(massage.visualKey) || (massage.zoneId === "vip" && !content.steps?.length)) fail("ADMIN_MASSAGE_CANNOT_REACTIVATE");
      if (massage.zoneId === "vip") {
        const [other] = await tx.select({ id: massages.id }).from(massages).where(and(eq(massages.zoneId, "vip"), eq(massages.isActive, true), ne(massages.id, id))).limit(1);
        if (other) fail("ADMIN_MASSAGE_VIP_EXISTS");
      }
    }
    await tx.update(massages).set({ isActive: active, bookingAvailable: active && massage.bookingAvailable, voucherAvailable: active && massage.voucherAvailable, updatedAt: new Date() }).where(eq(massages.id, id));
    return { id, alreadyApplied: false };
  });
};
