import type { PublicMassage } from "@/lib/catalog/massage";

export type MassageZoneId =
  "ukojenie" | "regeneracja" | "limfatyczna" | "twarz" | "vip";

export type MassageZoneType = "standard" | "vip";

export type MassageZoneDefinition = {
  id: MassageZoneId;
  name: string;
  shortName: string;
  description: string;
  type: MassageZoneType;
  order: number;
};

export type MassageZone = MassageZoneDefinition & {
  massages: PublicMassage[];
};

export const massageZoneDefinitions: MassageZoneDefinition[] = [
  {
    id: "ukojenie",
    name: "Strefa Ukojenia Ciała",
    shortName: "Ukojenie Ciała",
    description:
      "Dla osób, które żyją w napięciu, potrzebują wyciszenia i chwili odpoczynku od codziennego stresu.",
    type: "standard",
    order: 1,
  },

  {
    id: "regeneracja",
    name: "Strefa Regeneracji",
    shortName: "Regeneracja",
    description:
      "Dla osób, które potrzebują regeneracji po wysiłku, intensywnym dniu lub po prostu chcą pozwolić sobie na głębszy odpoczynek.",
    type: "standard",
    order: 2,
  },

  {
    id: "limfatyczna",
    name: "Strefa Limfatyczna",
    shortName: "Limfatyczna",
    description:
      "Dla osób, które chcą wesprzeć poczucie lekkości ciała oraz naturalne procesy związane z układem limfatycznym.",
    type: "standard",
    order: 3,
  },

  {
    id: "twarz",
    name: "Strefa Twarzy",
    shortName: "Twarz",
    description:
      "Dla osób, które chcą zadbać o odprężenie, napięcie i pielęgnację twarzy, szyi oraz dekoltu.",
    type: "standard",
    order: 4,
  },

  {
    id: "vip",
    name: "ORHEA VIP",
    shortName: "VIP",
    description:
      "Ekskluzywne doświadczenie ORHEA stworzone dla osób poszukujących wyjątkowego rytuału regeneracji i pełnego komfortu.",
    type: "vip",
    order: 5,
  },
];

export const getMassageZones = (catalog: PublicMassage[]): MassageZone[] =>
  massageZoneDefinitions
    .map((zone) => ({ ...zone, massages: catalog.filter((massage) => massage.zoneId === zone.id) }))
    .filter((zone) => zone.massages.length > 0)
    .sort((a, b) => a.order - b.order);

export const getMassageZoneById = (id: MassageZoneId) => {
  return massageZoneDefinitions.find((zone) => zone.id === id);
};

export const isMassageZoneId = (
  value: string | null,
): value is MassageZoneId => {
  if (!value) {
    return false;
  }

  return massageZoneDefinitions.some((zone) => zone.id === value);
};

export const resolveMassageZoneId = (
  value: string | null,
  fallback: MassageZoneId = "twarz",
): MassageZoneId => {
  return isMassageZoneId(value) ? value : fallback;
};
