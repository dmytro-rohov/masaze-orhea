import {
  getMassagesByZoneId,
  type Massage,
} from "@/data/massages";

export type MassageZoneId =
  | "ukojenie"
  | "regeneracja"
  | "limfatyczna"
  | "twarz"
  | "vip";

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
  massages: Massage[];
};

export const massageZoneDefinitions: MassageZoneDefinition[] = [
  {
    id: "ukojenie",
    name: "Strefa Ukojenia Ciała",
    shortName: "Ukojenie Ciała",
    description: "Dla osób, które żyją w napięciu, potrzebują wyciszenia i chwili odpoczynku od codziennego stresu.",
    type: "standard",
    order: 1,
  },

  {
    id: "regeneracja",
    name: "Strefa Regeneracji",
    shortName: "Regeneracja",
    description: "Dla osób, które potrzebują regeneracji po wysiłku, intensywnym dniu lub po prostu chcą pozwolić sobie na głębszy odpoczynek.",
    type: "standard",
    order: 2,
  },

  {
    id: "limfatyczna",
    name: "Strefa Limfatyczna",
    shortName: "Limfatyczna",
    description: "Dla osób, które chcą wesprzeć poczucie lekkości ciała oraz naturalne procesy związane z układem limfatycznym.",
    type: "standard",
    order: 3,
  },

  {
    id: "twarz",
    name: "Strefa Twarzy",
    shortName: "Twarz",
    description: "Dla osób, które chcą zadbać o odprężenie, napięcie i pielęgnację twarzy, szyi oraz dekoltu.",
    type: "standard",
    order: 4,
  },

  {
    id: "vip",
    name: "ORHEA VIP",
    shortName: "VIP",
    description: "Ekskluzywne doświadczenie ORHEA stworzone dla osób poszukujących wyjątkowego rytuału regeneracji i pełnego komfortu.",
    type: "vip",
    order: 5,
  },
];


export const allMassageZones: MassageZone[] = massageZoneDefinitions
  .map((zone) => ({
    ...zone,
    massages: getMassagesByZoneId(zone.id),
  }))
  .sort((a, b) => a.order - b.order);

export const massageZones: MassageZone[] = allMassageZones.filter(
  (zone) => zone.type === "standard",
);

/**
 * Osobna konfiguracja VIP.
 */
export const vipMassageZone = allMassageZones.find(
  (zone) => zone.type === "vip",
);

export const getMassageZoneById = (id: MassageZoneId) => {
  return allMassageZones.find((zone) => zone.id === id);
};