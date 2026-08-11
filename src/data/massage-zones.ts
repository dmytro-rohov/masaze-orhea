export type Massage = {
  id: string;
  name: string;
  labels?: string[];
};

export type MassageZone = {
  id: string;
  name: string;
  massages: Massage[];
};

export const massageZones: MassageZone[] = [
  {
    id: "ukojenie",
    name: "Ukojenia Ciała",
    massages: [
      {
        id: "classic-back",
        name: "Ukojenie dla pleców i karku - masaż klasyczny",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "desk-relief",
        name: "Rozluźnienie po pracy siedzącej - masaż pleców, karku i barków",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "classic-body",
        name: "Masaż klasyczny całego ciała",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "tension-relief",
        name: "Masaż ukierunkowany na napięcia",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "cupping",
        name: "Praca z tkanką i jędrnością skóry - masaż bańką chińską",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
    ],
  },

  {
    id: "regeneracja",
    name: "Strefa Regeneracji",
    massages: [
      {
        id: "relaxing-body",
        name: "Spokojne wyciszenie - masaż relaksacyjny całego ciała",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "hot-stone",
        name: "Regeneracja w cieple - masaż ciepłymi kamieniami",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "chocolate-ritual",
        name: "Czekoladowe odżywienie - rytuał relaksacyjny",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "honey-ritual",
        name: "Rytuał miodowy - masaż odżywczy i rozgrzewający",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "orhea-ritual",
        name: "Rytuał głębokiej regeneracji ORHEA",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
    ],
  },

  {
    id: "limfatyczna",
    name: "Strefa Limfatyczna",
    massages: [
      {
        id: "lymphatic-body",
        name: "Lekkość ciała - drenaż limfatyczny",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "lymphatic-legs",
        name: "Drenaż limfatyczny nóg",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "lymphatic-face",
        name: "Lekkość twarzy - drenaż limfatyczny twarzy",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
    ],
  },

  {
    id: "twarz",
    name: "Strefa Twarzy",
    massages: [
      {
        id: "cosmetic-face",
        name: "Pielęgnacja i odprężenie - masaż kosmetyczny twarzy",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "face-lifting",
        name: "Ujędrnienie i odprężenie - masaż liftingujący twarzy",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "face-neck",
        name: "Masaż twarzy, szyi i dekoltu",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
      {
        id: "face-cupping",
        name: "Rozluźnienie powięzi twarzy - masaż bańką",
        labels: [
          "na stres",
          "na plecy",
        ],
      },
    ],
  },
];