import type { MassageZoneId } from "@/data/massage-zones";

export type PublicMassageVariant = {
  id: string;
  code: string;
  durationMinutes: number | null;
  durationLabel: string | null;
  bookingSlotMinutes: number;
  priceGrosze: number;
  pricePLN: number;
  isActive: boolean;
  sortOrder: number;
};

export type PublicMassage = {
  id: string;
  slug: string;
  zoneId: MassageZoneId;
  title: string;
  serviceName: string | null;
  shortDescription: string;
  labels: string[];
  sortOrder: number;
  isActive: boolean;
  bookingAvailable: boolean;
  voucherAvailable: boolean;
  visualKey: string;
  variants: PublicMassageVariant[];
};

export type PublicMassageContent = {
  massageId: string;
  tagline?: string;
  description: Array<{ title?: string; paragraphs: string[] }>;
  bodyVisualKey: string | null;
  bodyVisualAlt?: string;
  forWhom: { title: string; items: string[] };
  expectations: { title: string; items: string[] };
  safety: { title: string; description: string };
  steps?: Array<{ id: string; label: string; durationLabel?: string; description: string }>;
  booking: { title: string; description: string };
  seoPhrases: string[];
  relatedMassageIds: string[];
};

export const formatMassagePrice = (grosze: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(grosze / 100);

export const getMassageFullName = (massage: PublicMassage) =>
  massage.serviceName ? `${massage.title} — ${massage.serviceName}` : massage.title;
export const getMassageOfferPath = (massage: Pick<PublicMassage, "slug">) => `/uslugi/${massage.slug}`;
export const getMassageBookingPath = (massage: Pick<PublicMassage, "id">) => `/rezerwacja?masaz=${encodeURIComponent(massage.id)}`;
export const getPrimaryMassageVariant = (massage: PublicMassage) => massage.variants[0];
export const getMassageDurationLabel = (massage: PublicMassage) => massage.variants
  .map((variant) => variant.durationLabel ?? `${variant.durationMinutes} min`)
  .join(" / ") || "—";
export const getMassagePriceLabel = (massage: PublicMassage) => massage.variants
  .map((variant) => formatMassagePrice(variant.priceGrosze))
  .join(" / ") || "—";
