import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { massageContent, massages, massageVariants } from "@/db/schema";
import { isMassageZoneId, type MassageZoneId } from "@/data/massage-zones";
import type { PublicMassage, PublicMassageContent } from "@/lib/catalog/massage";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isList = (value: unknown): value is { title: string; items: string[] } =>
  isRecord(value) && typeof value.title === "string" && Array.isArray(value.items) && value.items.every((item) => typeof item === "string");
const isSections = (value: unknown): value is PublicMassageContent["description"] =>
  Array.isArray(value) && value.every((item) => isRecord(item) &&
    (item.title === undefined || typeof item.title === "string") &&
    Array.isArray(item.paragraphs) && item.paragraphs.every((part: unknown) => typeof part === "string"));
const isSteps = (value: unknown): value is NonNullable<PublicMassageContent["steps"]> =>
  Array.isArray(value) && value.every((item) => isRecord(item) &&
    typeof item.id === "string" && typeof item.label === "string" &&
    typeof item.description === "string" &&
    (item.durationLabel === undefined || typeof item.durationLabel === "string"));

const toContent = (row: typeof massageContent.$inferSelect): PublicMassageContent | null => {
  if (!isSections(row.description) || !isList(row.forWhom) || !isList(row.expectations) ||
    !isRecord(row.safety) || typeof row.safety.title !== "string" || typeof row.safety.description !== "string" ||
    !isList({ title: row.bookingCta?.title, items: [] }) || typeof row.bookingCta?.description !== "string" ||
    (row.steps !== null && !isSteps(row.steps))) return null;
  return {
    massageId: row.massageId,
    tagline: row.tagline ?? undefined,
    description: row.description,
    bodyVisualKey: row.bodyVisualKey,
    bodyVisualAlt: row.bodyVisualAlt ?? undefined,
    forWhom: row.forWhom,
    expectations: row.expectations,
    safety: row.safety,
    steps: row.steps ?? undefined,
    booking: row.bookingCta,
    seoPhrases: row.seoPhrases,
    relatedMassageIds: row.relatedMassageIds,
  };
};

async function getCatalog(includeInactive = false): Promise<PublicMassage[]> {
  const rows = await db.select().from(massages)
    .where(includeInactive ? undefined : eq(massages.isActive, true))
    .orderBy(asc(massages.sortOrder), asc(massages.id));
  if (!rows.length) return [];
  const variantRows = await db.select().from(massageVariants)
    .where(inArray(massageVariants.massageId, rows.map((row) => row.id)))
    .orderBy(asc(massageVariants.sortOrder), asc(massageVariants.code));
  return rows.filter((row) => isMassageZoneId(row.zoneId)).map((row) => ({
    id: row.id,
    slug: row.slug,
    zoneId: row.zoneId as MassageZoneId,
    title: row.title,
    serviceName: row.serviceName,
    shortDescription: row.shortDescription,
    labels: row.labels,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    bookingAvailable: row.bookingAvailable,
    voucherAvailable: row.voucherAvailable,
    visualKey: row.visualKey,
    variants: variantRows.filter((variant) => variant.massageId === row.id && variant.isActive).map((variant) => ({
      id: variant.id,
      code: variant.code,
      durationMinutes: variant.durationMinutes,
      durationLabel: variant.durationLabel,
      bookingSlotMinutes: variant.bookingSlotMinutes,
      priceGrosze: variant.priceGrosze,
      pricePLN: variant.priceGrosze / 100,
      isActive: variant.isActive,
      sortOrder: variant.sortOrder,
    })),
  }));
}

export const getPublicMassageCatalog = () => getCatalog();
export const getBookableMassages = async () => (await getCatalog()).filter((item) => item.bookingAvailable && item.variants.length > 0);
export const getVoucherMassages = async () => (await getCatalog()).filter((item) => item.voucherAvailable && item.variants.length > 0);
export const getMassagesByZoneId = async (zoneId: MassageZoneId) => (await getCatalog()).filter((item) => item.zoneId === zoneId);
export const getPublicMassageById = async (id: string, includeInactive = false) => (await getCatalog(includeInactive)).find((item) => item.id === id);
export const getPublicMassageBySlug = async (slug: string, includeInactive = false) => (await getCatalog(includeInactive)).find((item) => item.slug === slug);
export const getMassagePageContent = async (massageId: string) => {
  const [row] = await db.select().from(massageContent).where(eq(massageContent.massageId, massageId)).limit(1);
  return row ? toContent(row) : null;
};
