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

export type Massage = {

  id: MassageId;
  slug: string;
  zoneId: MassageZoneId;
  title: string;
  serviceName?: string;
  shortDescription: string;
  durationMinutes: number;
  pricePLN: number;
  labels: string[];
  voucherAvailable: boolean;
  bookingAvailable: boolean;
  order: number;
};

export const massages: Massage[] = [

  // STREFA UKOJENIA CIAŁA
  {
    id: "classic-back",
    slug: "ukojenie-dla-plecow-i-karku",
    zoneId: "ukojenie",
    title: "Ukojenie dla pleców i karku",
    serviceName: "Masaż klasyczny",
    shortDescription:
      "Skoncentrowana praca z plecami i karkiem pomagająca rozluźnić napięcia i odzyskać większy komfort.",

    durationMinutes: 45,
    pricePLN: 170,
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
      "Masaż skoncentrowany na obszarach szczególnie obciążonych podczas długiej pracy przy biurku.",
    durationMinutes: 60,
    pricePLN: 210,
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
      "Kompleksowy masaż całego ciała wspierający rozluźnienie mięśni i ogólne odprężenie.",
    durationMinutes: 60,
    pricePLN: 230,
    labels: ["całe ciało", "rozluźnienie", "regeneracja"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 3,
  },

  {
    id: "tension-relief",
    slug: "masaz-ukierunkowany-na-napiecia",
    zoneId: "ukojenie",
    title: "Masaż ukierunkowany na napięcia",
    shortDescription:
      "Indywidualnie ukierunkowana praca na obszarach, w których najczęściej kumuluje się napięcie.",
    durationMinutes: 60,
    pricePLN: 240,
    labels: ["napięcie", "indywidualnie", "głębsza praca"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 4,
  },

  {
    id: "cupping",
    slug: "praca-z-tkanka-i-jedrnoscia-skory",
    zoneId: "ukojenie",
    title: "Praca z tkanką i jędrnością skóry",
    serviceName: "Masaż bańką chińską",
    shortDescription:
      "Dynamiczna technika pracy z tkankami wspierająca ich mobilność oraz pielęgnację wyglądu skóry.",
    durationMinutes: 45,
    pricePLN: 180,
    labels: ["bańka chińska", "tkanki", "jędrność"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 5,
  },

  // STREFA REGENERACJI
  {
    id: "relaxing-body",
    slug: "spokojne-wyciszenie",
    zoneId: "regeneracja",
    title: "Spokojne wyciszenie",
    serviceName: "Masaż relaksacyjny całego ciała",
    shortDescription: "Spokojny rytm masażu pomagający zwolnić, odprężyć ciało i oderwać się od codziennego napięcia.",
    durationMinutes: 60,
    pricePLN: 230,
    labels: ["relaks", "wyciszenie", "całe ciało"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 1,
  },

  {
    id: "hot-stone",
    slug: "regeneracja-w-cieple",
    zoneId: "regeneracja",
    title: "Regeneracja w cieple",
    serviceName: "Masaż ciepłymi kamieniami",
    shortDescription: "Połączenie masażu i przyjemnego ciepła kamieni stworzone z myślą o głębokim odprężeniu.",
    durationMinutes: 90,
    pricePLN: 320,
    labels: ["ciepło", "relaks", "kamienie"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 2,
  },

  {
    id: "chocolate-ritual",
    slug: "czekoladowe-odzywienie",
    zoneId: "regeneracja",
    title: "Czekoladowe odżywienie",
    serviceName: "Rytuał relaksacyjny",
    shortDescription: "Otulający rytuał łączący masaż z pielęgnacyjnym charakterem kosmetyków inspirowanych czekoladą.",
    durationMinutes: 90,
    pricePLN: 330,
    labels: ["rytuał", "czekolada", "pielęgnacja"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 3,
  },

  {
    id: "honey-ritual",
    slug: "rytual-miodowy",
    zoneId: "regeneracja",
    title: "Rytuał miodowy",
    serviceName: "Masaż odżywczy i rozgrzewający",
    shortDescription: "Rozgrzewający rytuał wykorzystujący masaż i pielęgnację dla poczucia komfortu oraz regeneracji.",
    durationMinutes: 90,
    pricePLN: 330,
    labels: ["miód", "ciepło", "odżywienie"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 4,
  },

  {
    id: "orhea-ritual",
    slug: "rytual-glebokiej-regeneracji-orhea",
    zoneId: "regeneracja",
    title: "Rytuał głębokiej regeneracji ORHEA",
    shortDescription: "Autorski rytuał ORHEA łączący różne elementy pracy z ciałem w jedno kompleksowe doświadczenie.",
    durationMinutes: 90,
    pricePLN: 350,
    labels: ["ORHEA", "rytuał", "regeneracja"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 5,
  },

  // STREFA LIMFATYCZNA
  {
    id: "lymphatic-body",
    slug: "lekkosc-ciala",
    zoneId: "limfatyczna",
    title: "Lekkość ciała",
    serviceName: "Drenaż limfatyczny całego ciała",
    shortDescription: "Delikatna, rytmiczna praca wspierająca naturalne procesy organizmu i poczucie lekkości.",
    durationMinutes: 60,
    pricePLN: 240,
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
    shortDescription: "Delikatna praca skoncentrowana na nogach, szczególnie dla osób poszukujących uczucia większej lekkości.",
    durationMinutes: 45,
    pricePLN: 190,
    labels: ["nogi", "lekkość", "drenaż"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 2,
  },

  {
    id: "lymphatic-face",
    slug: "lekkosc-twarzy",
    zoneId: "limfatyczna",
    title: "Lekkość twarzy",
    serviceName: "Drenaż limfatyczny twarzy",
    shortDescription: "Subtelna technika pracy z twarzą wspierająca odprężenie oraz naturalne poczucie lekkości.",
    durationMinutes: 45,
    pricePLN: 180,
    labels: ["twarz", "drenaż", "lekkość"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 3,
  },

  // STREFA TWARZY
  {
    id: "cosmetic-face",
    slug: "pielegnacja-i-odprezenie",
    zoneId: "twarz",
    title: "Pielęgnacja i odprężenie",
    serviceName: "Masaż kosmetyczny twarzy",
    shortDescription: "Delikatny masaż twarzy łączący odprężenie z elementem codziennej pielęgnacji.",
    durationMinutes: 45,
    pricePLN: 180,
    labels: ["twarz", "pielęgnacja", "relaks"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 1,
  },

  {
    id: "face-lifting",
    slug: "ujedrnienie-i-odprezenie",
    zoneId: "twarz",
    title: "Ujędrnienie i odprężenie",
    serviceName: "Masaż liftingujący twarzy",
    shortDescription: "Technika pracy z mięśniami i tkankami twarzy ukierunkowana na odprężenie oraz poprawę ich napięcia.",
    durationMinutes: 60,
    pricePLN: 220,
    labels: ["lifting", "twarz", "ujędrnienie"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 2,
  },

  {
    id: "face-neck",
    slug: "masaz-twarzy-szyi-i-dekoltu",
    zoneId: "twarz",
    title: "Masaż twarzy, szyi i dekoltu",
    shortDescription: "Kompleksowy masaż obejmujący twarz, szyję oraz dekolt, pomagający rozluźnić napięcia tych obszarów.",
    durationMinutes: 60,
    pricePLN: 220,
    labels: ["twarz", "szyja", "dekolt"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 3,
  },

  {
    id: "face-cupping",
    slug: "rozluznienie-powiezi-twarzy",
    zoneId: "twarz",
    title: "Rozluźnienie powięzi twarzy",
    serviceName: "Masaż bańką",
    shortDescription: "Delikatna praca bańką dostosowaną do twarzy, wspierająca mobilność tkanek i odprężenie.",
    durationMinutes: 45,
    pricePLN: 190,
    labels: ["twarz", "bańka", "powięź"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 4,
  },

  // VIP
  {
    id: "vip-ritual",
    slug: "rytual-vip",
    zoneId: "vip",
    title: "Rytuał VIP ORHEA",
    shortDescription: "Ekskluzywne doświadczenie stworzone z myślą o wyjątkowej regeneracji, komforcie i pełnym wyciszeniu.",
    durationMinutes: 180,
    pricePLN: 590,
    labels: ["VIP", "premium", "rytuał"],
    voucherAvailable: true,
    bookingAvailable: true,
    order: 1,
  },
];

/**
 Zwraca pełną nazwę masażu.
 */
export const getMassageFullName = (massage: Massage): string => {
  if (!massage.serviceName) {
    return massage.title;
  }

  return `${massage.title} — ${massage.serviceName}`;
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