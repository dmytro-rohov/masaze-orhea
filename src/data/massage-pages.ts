import type { ImageMetadata } from "astro";

import type { MassageId } from "@/data/massages";

// assets

import classicBackHero from "@/assets/img/massages/classic-back/hero.jpg";

import classicBackBody from "@/assets/img/massages/classic-back/body.png";

// =========================================================
// TYPES
// =========================================================

export type MassagePageSection = {
  title: string;
  items: string[];
};

export type MassagePageContent = {
  massageId: MassageId;

  heroImage: ImageMetadata;

  bodyImage?: ImageMetadata;

  description: string[];

  forWhom: MassagePageSection;

  expectations: MassagePageSection;

  safetyTitle?: string;

  safetyDescription?: string;

  relatedMassageIds?: MassageId[];
};

// =========================================================
// DATA
// =========================================================

export const massagePages: MassagePageContent[] = [
  {
    massageId: "classic-back",

    heroImage: classicBackHero,

    bodyImage: classicBackBody,

    description: [
      "Długi dzień przy komputerze zostawia końcu ślady nie tylko w głowie. Ciało często pamięta go jeszcze długo po zamknięciu laptopa. Kark robi się cięższy, barki trzymają napięcie, mięśnie przykręgosłupowe stają się sztywne, a dolna część pleców daje znać, że zbyt długo była w jednej pozycji.",

      "Ten masaż jest dla osób, które dużo siedzą i potrzebują konkretnej, spokojnej pracy z plecami, karkiem i barkami. Nie traktujemy go jak automatycznego 'rozmasowania pleców'. Najpierw pytamy, gdzie czujesz największe przeciążenie, czy jest ono bardziej powierzchowne, czy głębokie i jak reagujesz na nacisk.",

      "Przy pracy siedzącej napięcie często kumuluje się nie tylko w karku i barkach, ale też w okolicy łopatek, klatki piersiowej oraz dolnych pleców. Dlatego masaż może objąć kilka powiązanych obszarów, zamiast skupiać się wyłącznie na jednym miejscu.",
    ],

    forWhom: {
      title: "Dla kogo?",

      items: [
        "dla osób, które dużo pracują przy komputerze;",
        "dla osób, które czują napięcie w karku, barkach lub między łopatkami;",
        "dla osób, które po długim siedzeniu odczuwają przeciążenie dolnych pleców;",
        "dla osób, które chcą skupić masaż na plecach, karku i barkach;",
        "dla osób, które potrzebują rozluźnienia po pracy albo intensywnym dniu.",
      ],
    },

    expectations: {
      title: "Czego możesz się spodziewać?",

      items: [
        "krótkiej rozmowy przed rozpoczęciem masażu;",
        "pracy z karkiem, barkami, plecami i okolicą łopatek;",
        "uwzględnienia dolnych pleców, jeśli ciało tego potrzebuje;",
        "dopasowania intensywności do Twojego komfortu;",
        "uczucia większej swobody i rozluźnienia po sesji.",
      ],
    },

    safetyTitle: "Informacje bezpieczeństwa",

    safetyDescription:
      "Masaż nie zastępuje konsultacji lekarskiej ani fizjoterapeutycznej. Przed sesją przeprowadzamy krótki wywiad, aby dobrać masaż do Twoich potrzeb i wykluczyć podstawowe przeciwwskazania.",

    relatedMassageIds: ["desk-relief", "classic-body", "tension-relief"],
  },
];

export const getMassagePageById = (
  massageId: MassageId,
) => {
  return massagePages.find(
    (page) =>
      page.massageId === massageId,
  );
};