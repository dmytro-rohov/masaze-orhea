import type { MassageZoneId } from "@/data/massage-zones";

export type MassageId =
  | "classic-back"
  | "desk-relief"
  | "classic-body"
  | "tension-relief"
  | "cupping"
  | "relaxing-body"
  | "hot-stone"
  | "chocolate-ritual"
  | "honey-ritual"
  | "orhea-ritual"
  | "lymphatic-body"
  | "lymphatic-legs"
  | "lymphatic-face"
  | "cosmetic-face"
  | "face-lifting"
  | "face-neck"
  | "face-cupping"
  | "vip-ritual";

export type MassageVariant =
  | {
      durationMinutes: number;
      pricePLN: number;
      durationLabel?: never;
      bookingSlotMinutes?: never;
    }
  | {
      durationLabel: string;
      bookingSlotMinutes: number;
      pricePLN: number;
      durationMinutes?: never;
    };

export type Massage = {
  id: MassageId;
  slug: string;
  zoneId: MassageZoneId;
  title: string;
  serviceName?: string;
  shortDescription: string;
  variants: MassageVariant[];
  labels: string[];
  voucherAvailable: boolean;
  bookingAvailable: boolean;
  order: number;
};

export const massages: Massage[] = [
  {
    id: "classic-back",
    slug: "ukojenie-dla-plecow-i-karku",
    zoneId: "ukojenie",
    title: "Ukojenie dla pleców i karku",
    serviceName: "Masaż klasyczny",
    shortDescription:
      "Klasyczny masaż skoncentrowany na plecach, karku, barkach i okolicy łopatek, z intensywnością dopasowaną do komfortu.",
    variants: [{ durationMinutes: 60, pricePLN: 180 }],
    labels: ["plecy i kark", "napięcie", "rozluźnienie"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 1,
  },
  {
    id: "desk-relief",
    slug: "rozluznienie-po-pracy-siedzacej",
    zoneId: "ukojenie",
    title: "Rozluźnienie po pracy siedzącej",
    serviceName: "Masaż pleców, karku i barków",
    shortDescription:
      "Masaż obszarów szczególnie obciążonych podczas pracy przy komputerze: karku, barków, łopatek i pleców.",
    variants: [{ durationMinutes: 60, pricePLN: 190 }],
    labels: ["praca siedząca", "barki", "plecy"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 2,
  },
  {
    id: "classic-body",
    slug: "masaz-klasyczny-calego-ciala",
    zoneId: "ukojenie",
    title: "Masaż klasyczny całego ciała",
    shortDescription:
      "Całościowa praca z plecami, karkiem, ramionami, nogami, stopami i dłońmi, dopasowana do najbardziej zmęczonych obszarów.",
    variants: [
      { durationMinutes: 60, pricePLN: 200 },
      { durationMinutes: 90, pricePLN: 260 },
    ],
    labels: ["całe ciało", "rozluźnienie", "regeneracja"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 3,
  },
  {
    id: "tension-relief",
    slug: "masaz-ukierunkowany-na-napiecia",
    zoneId: "ukojenie",
    title: "Masaż indywidualny ORHEA",
    serviceName: "Praca z napięciem",
    shortDescription:
      "Indywidualna sesja, podczas której dobieramy obszary pracy, tempo i intensywność do aktualnych potrzeb ciała.",
    variants: [
      { durationMinutes: 60, pricePLN: 210 },
      { durationMinutes: 90, pricePLN: 270 },
    ],
    labels: ["napięcie", "indywidualnie", "dopasowany zakres"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 4,
  },
  {
    id: "cupping",
    slug: "praca-z-tkanka-i-jedrnoscia-skory",
    zoneId: "ukojenie",
    title: "Praca z tkanką",
    serviceName: "Masaż bańką chińską",
    shortDescription:
      "Bardziej zdecydowana forma masażu z użyciem podciśnienia, skupiona na wybranych obszarach ciała.",
    variants: [{ durationMinutes: 60, pricePLN: 190 }],
    labels: ["bańka chińska", "tkanki", "podciśnienie"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 5,
  },
  {
    id: "relaxing-body",
    slug: "spokojne-wyciszenie",
    zoneId: "ukojenie",
    title: "Spokojne wyciszenie",
    serviceName: "Masaż relaksacyjny całego ciała",
    shortDescription:
      "Łagodny masaż całego ciała o płynnym rytmie, nastawiony przede wszystkim na wyciszenie i odpoczynek.",
    variants: [
      { durationMinutes: 60, pricePLN: 200 },
      { durationMinutes: 90, pricePLN: 260 },
    ],
    labels: ["relaks", "wyciszenie", "całe ciało"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 6,
  },
  {
    id: "hot-stone",
    slug: "regeneracja-w-cieple",
    zoneId: "regeneracja",
    title: "Regeneracja w cieple",
    serviceName: "Masaż ciepłymi kamieniami",
    shortDescription:
      "Otulający masaż całego ciała łączący spokojne ruchy z przyjemnym ciepłem gładkich kamieni.",
    variants: [
      { durationMinutes: 60, pricePLN: 220 },
      { durationMinutes: 90, pricePLN: 290 },
    ],
    labels: ["ciepło", "relaks", "kamienie"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 1,
  },
  {
    id: "chocolate-ritual",
    slug: "czekoladowe-odzywienie",
    zoneId: "regeneracja",
    title: "Czekoladowe odżywienie",
    serviceName: "Rytuał relaksacyjny",
    shortDescription:
      "Zmysłowy rytuał łączący spokojny masaż całego ciała z pielęgnacyjną, czekoladową formułą.",
    variants: [{ durationMinutes: 90, pricePLN: 280 }],
    labels: ["rytuał", "czekolada", "pielęgnacja"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 2,
  },
  {
    id: "honey-ritual",
    slug: "rytual-miodowy",
    zoneId: "regeneracja",
    title: "Rytuał miodowy",
    serviceName: "Masaż odżywczy i rozgrzewający",
    shortDescription:
      "Ciepły, spokojny masaż całego ciała z pielęgnacyjnym preparatem zawierającym miód lub ekstrakt miodowy.",
    variants: [{ durationMinutes: 90, pricePLN: 280 }],
    labels: ["miód", "ciepło", "odżywienie"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 3,
  },
  {
    id: "orhea-ritual",
    slug: "rytual-glebokiej-regeneracji-orhea",
    zoneId: "regeneracja",
    title: "Rytuał głębokiej regeneracji ORHEA",
    shortDescription:
      "Autorska, wydłużona sesja łącząca przygotowanie ciała, masaż całego ciała i spokojne zakończenie.",
    variants: [{ durationMinutes: 120, pricePLN: 350 }],
    labels: ["ORHEA", "rytuał", "regeneracja"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 4,
  },
  {
    id: "lymphatic-body",
    slug: "lekkosc-ciala",
    zoneId: "limfatyczna",
    title: "Lekkość ciała",
    serviceName: "Manualny drenaż limfatyczny",
    shortDescription:
      "Bardzo delikatna, powierzchowna i rytmiczna praca prowadzona zgodnie z przebiegiem dróg odpływu limfy.",
    variants: [
      { durationMinutes: 60, pricePLN: 200 },
      { durationMinutes: 90, pricePLN: 260 },
    ],
    labels: ["lekkość", "drenaż", "całe ciało"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 1,
  },
  {
    id: "lymphatic-legs",
    slug: "drenaz-limfatyczny-nog",
    zoneId: "limfatyczna",
    title: "Drenaż limfatyczny nóg",
    shortDescription:
      "Delikatny masaż nóg prowadzony lekkimi, rytmicznymi ruchami, bez mocnego nacisku i ugniatania.",
    variants: [{ durationMinutes: 60, pricePLN: 180 }],
    labels: ["nogi", "lekkość", "drenaż"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 2,
  },
  {
    id: "lymphatic-face",
    slug: "lekkosc-twarzy",
    zoneId: "twarz",
    title: "Lekkość twarzy",
    serviceName: "Drenaż limfatyczny twarzy",
    shortDescription:
      "Subtelny masaż twarzy i szyi wykonywany bardzo lekkimi, rytmicznymi ruchami.",
    variants: [{ durationMinutes: 45, pricePLN: 150 }],
    labels: ["twarz", "drenaż", "lekkość"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 1,
  },
  {
    id: "cosmetic-face",
    slug: "pielegnacja-i-odprezenie",
    zoneId: "twarz",
    title: "Pielęgnacja i odprężenie",
    serviceName: "Masaż kosmetyczny twarzy",
    shortDescription:
      "Spokojny masaż twarzy łączący delikatną pielęgnację skóry z pracą nad napięciem mimiki.",
    variants: [{ durationMinutes: 45, pricePLN: 150 }],
    labels: ["twarz", "pielęgnacja", "relaks"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 2,
  },
  {
    id: "face-lifting",
    slug: "ujedrnienie-i-odprezenie",
    zoneId: "twarz",
    title: "Pobudzenie i odprężenie",
    serviceName: "Masaż liftingujący twarzy",
    shortDescription:
      "Bardziej aktywny masaż twarzy, który łączy odprężenie z pobudzeniem skóry i precyzyjną pracą z mimiką.",
    variants: [{ durationMinutes: 50, pricePLN: 170 }],
    labels: ["lifting", "twarz", "pobudzenie"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 3,
  },
  {
    id: "face-neck",
    slug: "masaz-twarzy-szyi-i-dekoltu",
    zoneId: "twarz",
    title: "Masaż twarzy, szyi i dekoltu",
    shortDescription:
      "Rozszerzona sesja obejmująca twarz, szyję i dekolt, łącząca odprężenie z pielęgnacją skóry.",
    variants: [{ durationMinutes: 60, pricePLN: 190 }],
    labels: ["twarz", "szyja", "dekolt"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 4,
  },
  {
    id: "face-cupping",
    slug: "rozluznienie-powiezi-twarzy",
    zoneId: "twarz",
    title: "Delikatne pobudzenie twarzy",
    serviceName: "Masaż bańką",
    shortDescription:
      "Subtelny masaż twarzy małą bańką i lekkim podciśnieniem, prowadzony ze stałym poślizgiem.",
    variants: [{ durationMinutes: 40, pricePLN: 150 }],
    labels: ["twarz", "bańka", "pobudzenie"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 5,
  },
  {
    id: "vip-ritual",
    slug: "rytual-vip",
    zoneId: "vip",
    title: "ORHEA VIP",
    serviceName: "Rytuał głębokiego ukojenia ciała i twarzy",
    shortDescription:
      "Najbardziej rozbudowany rytuał ORHEA, łączący pielęgnację skóry, saunę infrared oraz masaż całego ciała i twarzy.",
    variants: [
      {
        durationLabel: "około 3,5–4 godziny",
        bookingSlotMinutes: 240,
        pricePLN: 690,
      },
    ],
    labels: ["VIP", "sauna infrared", "rytuał"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 1,
  },
];

export const getMassageFullName = (massage: Massage): string => {
  if (!massage.serviceName) {
    return massage.title;
  }

  return `${massage.title} — ${massage.serviceName}`;
};

export const getMassageDurationLabel = (massage: Massage): string => {
  return massage.variants
    .map((variant) =>
      "durationMinutes" in variant
        ? `${variant.durationMinutes} min`
        : variant.durationLabel,
    )
    .join(" / ");
};

export const getMassagePriceLabel = (massage: Massage): string => {
  return massage.variants
    .map((variant) => `${variant.pricePLN} zł`)
    .join(" / ");
};

export const getPrimaryMassageVariant = (massage: Massage) => {
  const variant = massage.variants[0];

  if (!variant) {
    throw new Error(`Massage: brak wariantu cenowego dla "${massage.id}".`);
  }

  return variant;
};

export const getMassageById = (id: MassageId) => {
  return massages.find((massage) => massage.id === id);
};

export const getMassageBySlug = (slug: string) => {
  return massages.find((massage) => massage.slug === slug);
};

export const getMassagesByZoneId = (zoneId: MassageZoneId) => {
  return massages
    .filter((massage) => massage.zoneId === zoneId)
    .sort((a, b) => a.order - b.order);
};

export const standardMassages = massages.filter(
  (massage) => massage.zoneId !== "vip",
);

export const voucherMassages = massages.filter(
  (massage) => massage.voucherAvailable,
);

export const bookableMassages = massages.filter(
  (massage) => massage.bookingAvailable,
);
