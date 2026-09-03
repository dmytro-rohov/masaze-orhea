import type { ImageMetadata } from "astro";

import {
  getMassageById,
  getMassagesByZoneId,
  massages,
  type Massage,
  type MassageId,
} from "@/data/massages";
import type { MassageZoneId } from "@/data/massage-zones";

import ukojenieBodyVisual from "@/assets/img/massage-1.png";
import regeneracjaBodyVisual from "@/assets/img/zone-2.png";
import limfatycznaBodyVisual from "@/assets/img/zone-3.png";
import twarzBodyVisual from "@/assets/img/zone-4.png";
import vipBodyVisual from "@/assets/img/vip-zone.png";

export type MassagePageList = { title: string; items: string[] };
export type MassagePageSection = { title?: string; paragraphs: string[] };
export type MassagePageStep = {
  id: string;
  label: string;
  durationLabel?: string;
  description: string;
};

export type MassagePageContent = {
  massageId: MassageId;
  tagline?: string;
  description: MassagePageSection[];
  bodyVisual?: ImageMetadata;
  bodyVisualAlt?: string;
  forWhom: MassagePageList;
  expectations: MassagePageList;
  safety: { title: string; description: string };
  seoPhrases: string[];
  steps?: MassagePageStep[];
  booking: { title: string; description: string };
  relatedMassageIds: MassageId[];
};

const BODY_VISUAL_BY_ZONE: Record<MassageZoneId, ImageMetadata> = {
  ukojenie: ukojenieBodyVisual,
  regeneracja: regeneracjaBodyVisual,
  limfatyczna: limfatycznaBodyVisual,
  twarz: twarzBodyVisual,
  vip: vipBodyVisual,
};

const RELATED_LIMIT = 3;

type MassagePageDraft = Omit<
  MassagePageContent,
  "massageId" | "bodyVisual" | "bodyVisualAlt"
> & {
  bodyVisual?: ImageMetadata;
  bodyVisualAlt?: string;
};

const createPage = (
  massageId: MassageId,
  draft: MassagePageDraft,
): MassagePageContent => {
  const massage = getMassageById(massageId);
  if (!massage) throw new Error(`Massage page: brak masażu "${massageId}".`);
  return {
    massageId,
    ...draft,
    bodyVisual: draft.bodyVisual ?? BODY_VISUAL_BY_ZONE[massage.zoneId],
    bodyVisualAlt: draft.bodyVisualAlt ?? massage.serviceName ?? massage.title,
  };
};
const ORHEA_RITUAL_STEPS: MassagePageStep[] = [
  {
    id: "consultation",
    label: "Konsultacja",
    durationLabel: "ok. 5 min",
    description: "konsultacja — ok. 5 min",
  },
  {
    id: "warm-preparation",
    label: "Ciepły kompres / przygotowanie",
    durationLabel: "ok. 10 min",
    description: "ciepły kompres / przygotowanie — ok. 10 min",
  },
  {
    id: "body-massage",
    label: "Masaż całego ciała",
    durationLabel: "ok. 90 min",
    description: "masaż całego ciała — ok. 90 min",
  },
  {
    id: "calm-finish",
    label: "Spokojne zakończenie: stopy, dłonie lub głowa",
    durationLabel: "ok. 15 min",
    description: "spokojne zakończenie: stopy, dłonie lub głowa — ok. 15 min",
  },
];

const VIP_RITUAL_STEPS: MassagePageStep[] = [
  {
    id: "preparation",
    label: "Przygotowanie i prysznic",
    description: "przygotowanie i prysznic",
  },
  {
    id: "peeling",
    label: "Peeling całego ciała połączony z delikatnym masażem",
    durationLabel: "około 10–20 minut",
    description:
      "peeling całego ciała połączony z delikatnym masażem — około 10–20 minut",
  },
  {
    id: "sauna-first",
    label: "Pierwsza sesja w saunie infrared wraz z czasem na odpoczynek",
    durationLabel: "około 15–25 minut",
    description:
      "pierwsza sesja w saunie infrared wraz z czasem na odpoczynek — około 15–25 minut",
  },
  {
    id: "body-massage",
    label: "Masaż klasyczny całego ciała",
    durationLabel: "90 minut",
    description: "masaż klasyczny całego ciała — 90 minut",
  },
  {
    id: "sauna-second",
    label: "Druga sesja w saunie infrared wraz z odpoczynkiem",
    durationLabel: "około 15–25 minut",
    description:
      "druga sesja w saunie infrared wraz z odpoczynkiem — około 15–25 minut",
  },
  {
    id: "face-massage",
    label: "Relaksacyjny masaż twarzy",
    durationLabel: "30 minut",
    description: "relaksacyjny masaż twarzy — 30 minut",
  },
  {
    id: "finish",
    label:
      "Prysznic i nałożenie kremu odżywczego lub nawilżającego na ciało i twarz",
    durationLabel: "około 30 minut",
    description:
      "prysznic i nałożenie kremu odżywczego lub nawilżającego na ciało i twarz — około 30 minut",
  },
];

export const massagePageById: Record<MassageId, MassagePageContent> = {
  "classic-back": createPage("classic-back", {
    description: [
      {
        paragraphs: [
          "Plecy i kark często jako pierwsze przejmują budujące się każdego dnia napięcie. Z czasem może pojawić się uczucie ciężkości w barkach, sztywność między łopatkami albo potrzeba poruszania szyją po wielu godzinach pracy.",
          "Masaż rozpoczynamy od krótkiej rozmowy. Pytamy, gdzie napięcie jest najbardziej odczuwalne i czy potrzebujesz spokojniejszej pracy, czy bardziej zdecydowanego masażu. Następnie skupiamy się na plecach, karku, barkach oraz okolicy łopatek. W razie potrzeby uwzględniamy również dolne plecy. Wykorzystujemy klasyczne techniki głaskania, rozcierania i ugniatania. Tempo nie jest jednak narzucone z góry. Masaż może być łagodny i odprężający albo bardziej konkretny w miejscach wyraźnego przeciążenia.",
          "Nie chodzi o jak najmocniejszy nacisk. Liczy się dokładna praca z obszarem, który potrzebuje uwagi, oraz stopniowe zmniejszanie napięcia bez niepotrzebnego forsowania ciała.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób odczuwających napięcie pleców, karku lub barków;",
        "dla osób pracujących przy biurku;",
        "dla osób czujących sztywność w okolicy łopatek;",
        "dla osób, które chcą skupić masaż na górnej części ciała.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "masażu dopasowanego do Twojego komfortu;",
        "pracy z plecami, karkiem, barkami i okolicą łopatek;",
        "spokojnego lub bardziej zdecydowanego nacisku;",
        "uczucia większej swobody i rozluźnienia.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Przed masażem przeprowadzamy krótki wywiad i wykluczamy podstawowe przeciwwskazania. Masaż nie zastępuje konsultacji lekarskiej ani fizjoterapeutycznej.",
    },
    seoPhrases: [
      "masaż pleców i karku Wrocław",
      "masaż klasyczny pleców Wrocław",
      "masaż karku Wrocław",
      "masaż barków Wrocław",
      "masaż Zakrzów",
    ],
    booking: {
      title: "Zadbaj o swoje plecy, kark i barki",
      description: "Zarezerwuj masaż i poczuj różnicę już po jednej sesji.",
    },
    relatedMassageIds: ["desk-relief", "classic-body", "tension-relief"],
  }),

  "desk-relief": createPage("desk-relief", {
    description: [
      {
        paragraphs: [
          "Praca siedząca obciąża ciało w bardzo charakterystyczny sposób. Głowa przez wiele godzin pozostaje skierowana w stronę ekranu, barki przesuwają się do przodu, okolice łopatek stają się sztywne, a dolne plecy długo pozostają w jednej pozycji.",
          "Ten masaż koncentruje się właśnie na obszarach związanych z codzienną pracą przy biurku. Opracowujemy kark, obręcz barkową, okolice łopatek i plecy. Jeżeli czujesz również przeciążenie w odcinku lędźwiowym, możemy poświęcić mu więcej uwagi.",
          "Ważna jest nie tylko praca w miejscu, w którym odczuwasz napięcie. Kark, barki, klatka piersiowa i okolice łopatek wpływają na siebie wzajemnie. Dlatego zakres masażu dobieramy tak, aby nie ograniczać się automatycznie do jednego punktu.",
          "To konkretna, ale uważna sesja dla osób, które po zakończeniu pracy nadal odczuwają jej skutki w ciele.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób pracujących przy komputerze;",
        "dla osób długo pozostających w pozycji siedzącej;",
        "dla osób odczuwających sztywność karku i barków;",
        "dla osób czujących przeciążenie między łopatkami lub w dolnych plecach.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "pracy skoncentrowanej na obszarach przeciążanych podczas siedzenia;",
        "uwzględnienia karku, barków, łopatek i pleców;",
        "indywidualnego doboru intensywności;",
        "masażu nastawionego na większy komfort po pracy.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Jeżeli napięciu towarzyszą ostre dolegliwości, drętwienie, osłabienie kończyny lub inne niepokojące objawy, przed masażem wskazana jest konsultacja medyczna albo fizjoterapeutyczna.",
    },
    seoPhrases: [
      "masaż po pracy siedzącej Wrocław",
      "masaż pleców karku i barków Wrocław",
      "masaż dla pracujących przy komputerze Wrocław",
      "masaż pleców Zakrzów",
    ],
    booking: {
      title: "Rozluźnij ciało po dniu przy biurku",
      description:
        "Zarezerwuj godzinę dla barków, karku i pleców, które noszą Twoją pracę.",
    },
    relatedMassageIds: ["classic-back", "tension-relief", "classic-body"],
  }),

  "classic-body": createPage("classic-body", {
    description: [
      {
        paragraphs: [
          "Kiedy napięcie nie zatrzymuje się w jednym miejscu, masaż wyłącznie pleców może być niewystarczający. Zmęczenie może obejmować barki, nogi, ramiona i stopy, a ciało potrzebuje wtedy bardziej całościowej pracy.",
          "Masaż klasyczny całego ciała łączy techniki głaskania, rozcierania i ugniatania. W zależności od potrzeb może być spokojniejszy albo bardziej zdecydowany. Nie oznacza to jednak, że wszystkie partie masujemy w identyczny sposób. Więcej czasu poświęcamy obszarom, które są wyraźnie napięte, a delikatniej pracujemy tam, gdzie ciało jest bardziej wrażliwe.",
          "Zakres sesji ustalamy wspólnie. Możesz wskazać miejsca, które wymagają większej uwagi, oraz obszary, których nie chcesz obejmować masażem.",
          "To dobry wybór po intensywnym tygodniu, większym wysiłku albo wtedy, gdy potrzebujesz ogólnego rozluźnienia i regeneracji.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób czujących napięcie w kilku obszarach ciała;",
        "dla osób szukających pełnego masażu klasycznego;",
        "dla osób zmęczonych po intensywnym tygodniu;",
        "dla osób, które wolą masaż bardziej konkretny niż typowo relaksacyjny.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "pracy z całym ciałem;",
        "indywidualnego rozłożenia czasu między poszczególne obszary;",
        "intensywności dobranej do Twoich preferencji;",
        "połączenia dokładnego masażu i spokojnego zakończenia sesji.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Przed masażem pytamy o stan zdrowia, urazy, przyjmowane leki oraz miejsca, których nie należy opracowywać. Masaż nie zastępuje diagnostyki ani leczenia.",
    },
    seoPhrases: [
      "masaż klasyczny całego ciała Wrocław",
      "masaż całego ciała Wrocław",
      "masaż klasyczny Zakrzów",
      "masaż regeneracyjny Wrocław",
    ],
    booking: {
      title: "Daj całemu ciału czas na regenerację",
      description:
        "Zarezerwuj masaż klasyczny i pozwól mięśniom wrócić do równowagi.",
    },
    relatedMassageIds: ["tension-relief", "relaxing-body", "classic-back"],
  }),

  "tension-relief": createPage("tension-relief", {
    description: [
      {
        paragraphs: [
          "Nie zawsze można zamknąć potrzebę ciała w jednej nazwie usługi. Napięcie może zaczynać się w karku, obejmować okolice łopatek i jednocześnie pojawiać się w dolnych plecach. Innym razem po intensywnym tygodniu trudno wskazać jedno miejsce, które wymaga największej uwagi. Masaż indywidualny ORHEA nie ma sztywno ustalonego schematu. Przed sesją rozmawiamy o Twoim samopoczuciu, trybie pracy, preferowanej intensywności i obszarach napięcia. Na tej podstawie ustalamy zakres masażu. Możemy połączyć pracę z plecami, karkiem, barkami, nogami lub innymi partiami. W jednym miejscu nacisk może być bardziej zdecydowany, a w innym spokojniejszy. Najważniejsze jest to, aby masaż odpowiadał na aktualną potrzebę, zamiast powtarzać ten sam układ przy każdej wizycie. To także dobry wybór na pierwszą wizytę, gdy nie masz pewności, która pozycja z oferty będzie dla Ciebie odpowiednia.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które nie wiedzą, jaki masaż wybrać;",
        "dla osób odczuwających napięcie w kilku obszarach;",
        "dla osób oczekujących indywidualnego przebiegu sesji;",
        "dla osób, których potrzeby zmieniają się między wizytami.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "krótkiej konsultacji przed masażem;",
        "doboru obszarów zamiast gotowego schematu;",
        "zmiennej intensywności dopasowanej do ciała;",
        "uważnej pracy skoncentrowanej na aktualnej potrzebie.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Masaż jest dobierany na podstawie wywiadu, ale nie zastępuje badania ani konsultacji ze specjalistą w przypadku urazu, ostrego bólu lub objawów neurologicznych.",
    },
    seoPhrases: [
      "masaż indywidualny Wrocław",
      "masaż dopasowany do potrzeb Wrocław",
      "masaż na napięcie Wrocław",
      "masaż ORHEA Zakrzów",
    ],
    booking: {
      title: "Pracuj tam, gdzie napięcie zbiera się najczęściej",
      description:
        "Zarezerwuj masaż ukierunkowany i daj ciału konkretną, spokojną uwagę.",
    },
    relatedMassageIds: ["classic-body", "desk-relief", "cupping"],
  }),

  cupping: createPage("cupping", {
    description: [
      {
        paragraphs: [
          "Masaż bańką chińską wyraźnie różni się od spokojnego masażu relaksacyjnego. Bańka zasysa skórę i powierzchowne tkanki, a następnie przesuwana jest po odpowiednio natłuszczonym obszarze. Dzięki temu masaż daje mocniejsze odczucie pracy.",
          "Sesja może obejmować uda, pośladki, brzuch lub inne partie, zależnie od potrzeb i przeciwwskazań. Siłę podciśnienia zwiększamy stopniowo. Mocniejszy nacisk nie jest celem samym w sobie, a masaż nie powinien być prowadzony agresywnie.",
          "Bezpośrednio po sesji skóra może być zaczerwieniona i bardziej wrażliwa. Przy większej podatności mogą pojawić się również przejściowe ślady. Przed masażem pytamy więc o skłonność do siniaków, stan naczyń krwionośnych, przyjmowane leki i wrażliwość skóry.",
          "Masażu nie przedstawiamy jako sposobu na usunięcie cellulitu. Może być natomiast elementem pielęgnacji ciała i pracy z elastycznością tkanek.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób lubiących wyraźniejsze odczucie masażu;",
        "dla osób chcących pracować z wybranymi obszarami ciała;",
        "dla osób zainteresowanych pielęgnacją i pobudzeniem skóry;",
        "dla osób bez przeciwwskazań do masażu podciśnieniowego.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "stopniowego dopasowania podciśnienia;",
        "masażu po odpowiednio natłuszczonej skórze;",
        "wyraźniejszej pracy niż w masażu relaksacyjnym;",
        "możliwego, przejściowego zaczerwienienia.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Masażu nie wykonujemy m.in. przy podejrzeniu zakrzepicy, żylakach w obszarze pracy, zaburzeniach krzepnięcia, lekach przeciwkrzepliwych, aktywnych zmianach skórnych i znacznej skłonności do siniaków.",
    },
    seoPhrases: [
      "masaż bańką chińską Wrocław",
      "masaż podciśnieniowy Wrocław",
      "masaż ciała bańką Wrocław",
      "masaż antycellulitowy Wrocław",
      "masaż bańką Zakrzów",
    ],
    booking: {
      title: "Daj tkankom inną jakość ruchu",
      description:
        "Zarezerwuj masaż bańką chińską i poczuj bardziej dynamiczną pracę z ciałem.",
    },
    relatedMassageIds: ["tension-relief", "classic-body", "face-cupping"],
  }),

  "relaxing-body": createPage("relaxing-body", {
    description: [
      {
        paragraphs: [
          "Po intensywnym dniu ciało nie zawsze potrzebuje mocniejszego bodźca. Czasem znacznie lepiej odpowiada na spokojne tempo, powtarzalny rytm i dotyk, który nie stawia przed nim kolejnych wymagań.",
          "Masaż relaksacyjny całego ciała prowadzimy płynnie i bez pośpiechu. Może obejmować plecy, kark, ramiona, nogi, stopy i dłonie. Ruchy są łagodniejsze niż w masażu klasycznym, a zmiany tempa ograniczone tak, aby sesja pozostała spójna i wyciszająca.",
          "Jeżeli jeden z obszarów jest bardziej napięty, możemy poświęcić mu dodatkową uwagę, ale nie zamieniamy masażu w intensywne opracowywanie konkretnego punktu. Głównym celem pozostaje odpoczynek całego ciała. To propozycja dla osób, które długo funkcjonują w napięciu, mają za sobą trudny tydzień albo po prostu potrzebują spokojnej chwili dla siebie.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób zestresowanych i przebodźcowanych;",
        "dla osób potrzebujących łagodniejszego masażu;",
        "dla osób zmęczonych po intensywnym tygodniu;",
        "dla osób szukających wyciszenia całego ciała.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "wolniejszego i płynnego rytmu;",
        "łagodnej intensywności;",
        "masażu całego ciała;",
        "spokojnej, nieprzerywanej atmosfery sesji.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Przed rozpoczęciem przeprowadzamy krótki wywiad i ustalamy zakres masażu. W przypadku gorączki, infekcji, świeżego urazu albo aktywnego stanu zapalnego wizytę należy przełożyć.",
    },
    seoPhrases: [
      "masaż relaksacyjny Wrocław",
      "masaż relaksacyjny całego ciała Wrocław",
      "masaż odprężający Wrocław",
      "masaż dla zestresowanych Wrocław",
      "masaż Zakrzów",
    ],
    booking: {
      title: "Pozwól ciału zwolnić",
      description:
        "Zarezerwuj masaż relaksacyjny i daj sobie czas na prawdziwe wyciszenie.",
    },
    relatedMassageIds: ["hot-stone", "classic-body", "orhea-ritual"],
  }),

  "hot-stone": createPage("hot-stone", {
    description: [
      {
        paragraphs: [
          "Ciepło potrafi zmienić sposób, w jaki ciało odbiera masaż. Ruchy stają się bardziej płynne, tempo naturalnie zwalnia, a uwaga łatwiej odrywa się od codziennych obowiązków. Podczas sesji wykorzystujemy podgrzane, gładkie kamienie jako element masażu pleców, ramion, nóg i innych ustalonych obszarów. Kamienie mogą być przesuwane po ciele lub na krótko układane w wybranych miejscach. Nie zastępują pracy dłoni, lecz uzupełniają ją o równomierne, przyjemne ciepło.",
          "Temperatura zawsze powinna pozostawać komfortowa. Przed masażem pytamy o wrażliwość skóry, zaburzenia czucia, choroby przewlekłe i reakcję organizmu na ciepło. W czasie sesji możesz w każdej chwili poprosić o zmianę temperatury.",
          "To dobry wybór dla osób, które chcą połączyć masaż relaksacyjny z bardziej otulającym doświadczeniem.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób lubiących ciepło;",
        "dla osób potrzebujących spokojnej regeneracji;",
        "dla osób zmęczonych i przebodźcowanych;",
        "dla osób szukających wolniejszego masażu całego ciała.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "sprawdzenia komfortu cieplnego;",
        "połączenia pracy dłoni i ciepłych kamieni;",
        "płynnego, spokojnego tempa;",
        "uczucia otulenia i odpoczynku.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Masaż wymaga szczególnej ostrożności przy zaburzeniach czucia temperatury, neuropatii, niektórych chorobach sercowo-naczyniowych, aktywnych stanach zapalnych i zmianach skórnych.",
    },
    seoPhrases: [
      "masaż ciepłymi kamieniami Wrocław",
      "masaż gorącymi kamieniami Wrocław",
      "masaż kamieniami Wrocław",
      "masaż relaksacyjny Zakrzów",
    ],
    booking: {
      title: "Zregeneruj ciało w cieple",
      description:
        "Zarezerwuj masaż kamieniami i zostań w rytuale dłużej niż zwykle.",
    },
    relatedMassageIds: ["orhea-ritual", "relaxing-body", "honey-ritual"],
  }),

  "chocolate-ritual": createPage("chocolate-ritual", {
    description: [
      {
        paragraphs: [
          "Czekoladowy rytuał nie jest intensywnym masażem nastawionym na opracowywanie jednego napiętego miejsca. Jego charakter budują zapach, płynność ruchów, ciepło dłoni i pielęgnacyjne właściwości czekolady.",
          "Masaż może obejmować plecy, ramiona, nogi, stopy i dłonie. Wykorzystujemy preparat na bazie składników emoliencyjnych, takich jak masło kakaowe, wzbogacony o kakao albo czekoladową nutę zapachową oraz kostki prawdziwej czekolady. Dokładny skład użytych produktów jest zawsze dostępny do wglądu przed sesją.",
          "Ruchy są wolniejsze i bardziej otulające niż w masażu klasycznym. Olejki i czekolada zapewniają odpowiedni poślizg i pozostawią skórę przyjemną w dotyku, jędrną i odżywioną. A po masażu na długo pozostwią przyjemny aromat czekolady na skórze.",
          "Nie przypisujemy im działania leczniczego ani efektu odmładzającego. Najważniejsze są komfort, pielęgnacja i odpoczynek.",
          "To rytuał dla osób, które chcą wybrać coś bardziej zmysłowego niż standardowy masaż relaksacyjny a także poczuć się otulone czekoladowym niebem.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób lubiących ciepłe, czekoladowe zapachy;",
        "dla osób chcących połączyć masaż z pielęgnacją skóry;",
        "dla osób potrzebujących spokojnego odpoczynku;",
        "dla osób szukających rytuału o bardziej sensorycznym charakterze.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "masażu całego ciała;",
        "kosmetyku o czekoladowej formule;",
        "miękkiego i płynnego rytmu;",
        "pielęgnacyjnego wykończenia skóry.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Przed rytuałem pytamy o alergie, nadwrażliwość na zapachy i reakcje skórne. Ostateczny opis usługi należy dostosować do rzeczywistego składu używanego kosmetyku.",
    },
    seoPhrases: [
      "masaż czekoladą Wrocław",
      "rytuał czekoladowy Wrocław",
      "masaż czekoladowy Wrocław",
      "masaż relaksacyjny Zakrzów",
    ],
    booking: {
      title: "Otul ciało czekoladowym rytuałem",
      description:
        "Zarezerwuj sesję, która łączy masaż z pielęgnacją i chwilą przyjemności.",
    },
    relatedMassageIds: ["honey-ritual", "orhea-ritual", "relaxing-body"],
  }),

  "honey-ritual": createPage("honey-ritual", {
    description: [
      {
        paragraphs: [
          "Rytuał miodowy opiera się na spokojnym masażu oraz pielęgnacyjnym preparacie, którego formuła wykorzystuje miód, ekstrakt miodowy lub składniki inspirowane produktami pszczelimi. Kosmetyk nadaje sesji ciepły, odżywczy charakter i zapewnia odpowiedni poślizg.",
          "Masaż prowadzimy wolno, skupiając się bardziej na płynności i odczuciu otulenia niż na intensywnej pracy z tkankami. Może obejmować plecy, ramiona, nogi, stopy i dłonie.",
          "Nazwa „rozgrzewający” odnosi się przede wszystkim do charakteru rytuału, temperatury kosmetyku i spokojnego ciepła towarzyszącego masażowi. Nie stosujemy preparatów wywołujących silne pieczenie ani drażnienie skóry.",
          "Po rytuale skóra może być bardziej miękka i przyjemna w dotyku, a ciało spokojniejsze. Nie przedstawiamy jednak miodu jako środka leczniczego.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób lubiących ciepłe, miodowe nuty;",
        "dla osób chcących połączyć relaks z pielęgnacją;",
        "dla osób zmęczonych po intensywnym tygodniu;",
        "dla osób szukających otulającego masażu całego ciała.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "łagodnego, spokojnego tempa;",
        "zastosowania kosmetyku o miodowej formule;",
        "masażu całego ciała;",
        "przyjemnego wykończenia skóry.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Rytuału nie wykonujemy przy alergii na miód, produkty pszczele lub składniki zastosowanego kosmetyku. Przed sesją sprawdzamy również stan skóry i jej wrażliwość.",
    },
    seoPhrases: [
      "masaż miodem Wrocław",
      "rytuał miodowy Wrocław",
      "masaż odżywczy Wrocław",
      "masaż rozgrzewający Wrocław",
      "masaż Zakrzów",
    ],
    booking: {
      title: "Rozgrzej i odżyw ciało",
      description: "Zarezerwuj rytuał miodowy i zostań w cieple dłużej.",
    },
    relatedMassageIds: ["chocolate-ritual", "hot-stone", "orhea-ritual"],
  }),

  "orhea-ritual": createPage("orhea-ritual", {
    description: [
      {
        paragraphs: [
          "Rytuał głębokiej regeneracji ORHEA powstał z myślą o osobach, które nie chcą wybierać między masażem pleców, pracą z całym ciałem a spokojnym wyciszeniem. Jest dłuższy i bardziej rozbudowany niż standardowa sesja.",
          "Rytuał rozpoczynamy od rozmowy i ustalenia, czego najbardziej potrzebujesz w danym dniu. Następnie przygotowujemy ciało do masażu za pomocą ciepłego kompresu na stopy lub wybrany obszar. Główna część obejmuje płynny masaż całego ciała, z dokładniejszą pracą tam, gdzie pojawia się napięcie. Sesję kończymy spokojnym masażem stóp, dłoni albo głowy, zależnie od wybranego wariantu.",
          "Intensywność nie jest jednakowa przez cały czas. Może być bardziej konkretna w obrębie pleców i barków, a łagodniejsza w pozostałych częściach ciała. Rytuał ma tworzyć spójną całość, a nie być przypadkowym połączeniem kilku technik.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób potrzebujących dłuższej sesji;",
        "dla osób zmęczonych i przebodźcowanych;",
        "dla osób chcących połączyć masaż całego ciała z elementem ciepła;",
        "dla osób szukających autorskiego doświadczenia ORHEA.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "krótkiej konsultacji;",
        "ciepłego elementu przygotowującego ciało;",
        "masażu całego ciała;",
        "dokładniejszej pracy z wybranymi obszarami;",
        "spokojnego zakończenia sesji.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Zakres rytuału dobieramy na podstawie wywiadu. Elementy wykorzystujące ciepło lub kosmetyki stosujemy po sprawdzeniu indywidualnych przeciwwskazań.",
    },
    seoPhrases: [
      "rytuał regeneracyjny Wrocław",
      "autorski masaż Wrocław",
      "masaż głęboka regeneracja Wrocław",
      "długi masaż relaksacyjny Wrocław",
      "ORHEA Zakrzów",
    ],
    steps: ORHEA_RITUAL_STEPS,
    booking: {
      title: "Wejdź w rytuał głębokiej regeneracji",
      description:
        "Zarezerwuj autorską sesję ORHEA i daj ciału pełne 120 minut uwagi.",
    },
    relatedMassageIds: ["hot-stone", "vip-ritual", "relaxing-body"],
  }),

  "lymphatic-body": createPage("lymphatic-body", {
    description: [
      {
        paragraphs: [
          "Manualny drenaż limfatyczny nie polega na mocnym ugniataniu ani intensywnym nacisku. Układ limfatyczny znajduje się płytko, dlatego ruchy są lekkie, powtarzalne i wykonywane w spokojnym rytmie.",
          "Przed sesją ustalamy zakres pracy. Drenaż może obejmować całe ciało lub wybrane obszary, zależnie od potrzeb i kwalifikacji do masażu. Praca rozpoczyna się od przygotowania okolic, do których kierowany jest przepływ, a następnie obejmuje kolejne partie ciała.",
          "Drenaż może wspierać odczucie lekkości i komfortu. Nie przedstawiamy go jednak jako „detoksu”, sposobu na odchudzanie ani samodzielnego leczenia rozpoznanego obrzęku limfatycznego. Osoby po operacjach, leczeniu onkologicznym albo z rozpoznaną chorobą układu limfatycznego powinny korzystać z drenażu w ramach odpowiednio zaplanowanego postępowania i po konsultacji ze specjalistą.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób preferujących bardzo delikatny masaż;",
        "dla osób odczuwających ciężkość ciała;",
        "dla osób długo siedzących albo stojących;",
        "dla osób chcących wspierać naturalny przepływ limfy.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "lekkiego i powierzchownego dotyku;",
        "powtarzalnych, rytmicznych ruchów;",
        "braku mocnego ugniatania;",
        "spokojnego tempa całej sesji.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Drenażu nie wykonujemy przy podejrzeniu zakrzepicy, ostrej infekcji, gorączce, niewyjaśnionym obrzęku, aktywnym stanie zapalnym ani niewyrównanej niewydolności serca.",
    },
    seoPhrases: [
      "manualny drenaż limfatyczny Wrocław",
      "drenaż limfatyczny ciała Wrocław",
      "masaż limfatyczny Wrocław",
      "drenaż limfatyczny Zakrzów",
    ],
    booking: {
      title: "Przywróć ciału poczucie lekkości",
      description:
        "Zarezerwuj drenaż limfatyczny i daj sobie godzinę delikatnej pracy.",
    },
    relatedMassageIds: ["lymphatic-legs", "lymphatic-face", "relaxing-body"],
  }),

  "lymphatic-legs": createPage("lymphatic-legs", {
    description: [
      {
        paragraphs: [
          "Nogi mogą wydawać się ciężkie po całym dniu w jednej pozycji, długiej pracy stojącej albo wielogodzinnej podróży. W takiej sytuacji intensywny masaż nie zawsze jest najlepszym wyborem. Drenaż limfatyczny nóg prowadzimy delikatnie i powierzchownie. Praca może obejmować uda, okolice kolan, łydki i stopy, ale jej dokładny przebieg zależy od wywiadu oraz występujących przeciwwskazań.",
          "Ruchy wykonywane są zgodnie z kierunkiem odpływu limfy. Nie stosujemy mocnego ugniatania ani gwałtownego nacisku. Celem jest spokojna praca, która może wspierać uczucie lekkości i większego komfortu.",
          "Nagły, bolesny albo jednostronny obrzęk wymaga konsultacji medycznej. W takiej sytuacji masaż nie powinien być pierwszym działaniem.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób długo siedzących;",
        "dla osób pracujących w pozycji stojącej;",
        "dla osób odczuwających ciężkość nóg;",
        "dla osób preferujących bardzo delikatną technikę.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "lekkich, rytmicznych ruchów;",
        "pracy bez głębokiego nacisku;",
        "skupienia na nogach;",
        "spokojnego tempa i uczucia odciążenia.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Masażu nie wykonujemy przy podejrzeniu zakrzepicy, nagłym jednostronnym obrzęku, ostrym stanie zapalnym, infekcji, niewyrównanej niewydolności serca lub nieustalonej przyczynie dolegliwości.",
    },
    seoPhrases: [
      "drenaż limfatyczny nóg Wrocław",
      "masaż limfatyczny nóg Wrocław",
      "masaż na ciężkie nogi Wrocław",
      "drenaż nóg Zakrzów",
    ],
    booking: {
      title: "Odciąż zmęczone nogi",
      description:
        "Zarezerwuj drenaż limfatyczny nóg i poczuj różnicę w codziennym komforcie.",
    },
    relatedMassageIds: ["lymphatic-body", "classic-body", "lymphatic-face"],
  }),

  "lymphatic-face": createPage("lymphatic-face", {
    description: [
      {
        paragraphs: [
          "Po nieprzespanej nocy, długim dniu albo okresie większego zmęczenia twarz może wyglądać na cięższą i mniej wypoczętą. Drenaż limfatyczny jest w takiej sytuacji spokojniejszą alternatywą dla aktywnego masażu liftingującego.",
          "Praca obejmuje twarz oraz szyję, ponieważ prawidłowy przebieg drenażu nie powinien ograniczać się wyłącznie do policzków czy okolicy oczu. Ruchy są lekkie, powolne i powierzchowne. Skóra nie jest mocno ugniatana ani rozciągana.",
          "Masaż może wspierać naturalny przepływ limfy i dawać uczucie większej lekkości. Efekt wizualny jest subtelny i indywidualny. Nie obiecujemy trwałego usunięcia obrzęku ani zmiany rysów twarzy. Drenaż twarzy najlepiej wybierać wtedy, gdy zależy Ci przede wszystkim na lekkości i delikatnej pracy. Przy napięciu żuchwy lub mocno napiętej mimice odpowiedniejszy może być masaż kosmetyczny, liftingujący albo masaż twarzy, szyi i dekoltu.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób odczuwających ciężkość twarzy;",
        "dla osób preferujących bardzo delikatny dotyk;",
        "dla osób chcących zadbać o bardziej wypoczęty wygląd;",
        "dla osób, które nie potrzebują intensywnej pracy modelującej.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "lekkich i rytmicznych ruchów;",
        "pracy z twarzą oraz szyją;",
        "braku mocnego ugniatania;",
        "uczucia lekkości i odprężenia.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Masażu nie wykonujemy przy aktywnej opryszczce, infekcji, ostrym stanie zapalnym skóry, niewyjaśnionym obrzęku ani bezpośrednio po zabiegach medycyny estetycznej.",
    },
    seoPhrases: [
      "drenaż limfatyczny twarzy Wrocław",
      "masaż limfatyczny twarzy Wrocław",
      "drenaż twarzy Wrocław",
      "drenaż twarzy Zakrzów",
    ],
    booking: {
      title: "Daj twarzy chwilę lekkości",
      description:
        "Zarezerwuj drenaż limfatyczny twarzy i poczuj subtelną różnicę.",
    },
    relatedMassageIds: ["cosmetic-face", "face-lifting", "lymphatic-body"],
  }),

  "cosmetic-face": createPage("cosmetic-face", {
    description: [
      {
        paragraphs: [
          "Twarz reaguje na stres, koncentrację i zmęczenie. Napięcie może pojawiać się przy żuchwie, między brwiami, na czole albo w skroniach, nawet gdy nie zwracasz na nie uwagi w ciągu dnia. Masaż kosmetyczny twarzy jest łagodną formą pielęgnacji i odprężenia. Obejmuje twarz, bez rozbudowanej pracy z szyją i dekoltem. Dzięki temu sprawdzi się jako krótsza, skoncentrowana sesja lub uzupełnienie regularnej pielęgnacji.",
          "Ruchy są płynne i dopasowane do wrażliwości skóry. Możemy poświęcić więcej uwagi okolicy żuchwy, policzkom, czołu lub skroniom, zależnie od tego, gdzie czujesz napięcie. Stosowany kosmetyk dobieramy do rodzaju skóry i przebiegu masażu. Sesja nie zastępuje zabiegu dermatologicznego ani medycyny estetycznej. Jej celem jest przyjemne pobudzenie skóry, rozluźnienie mimiki i odpoczynek.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób chcących zadbać przede wszystkim o twarz;",
        "dla osób odczuwających napięcie mimiki;",
        "dla osób potrzebujących spokojnej pielęgnacji;",
        "dla osób preferujących delikatniejszy masaż.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "pracy skoncentrowanej na twarzy;",
        "delikatnego pobudzenia skóry;",
        "odprężenia czoła, skroni, policzków i żuchwy;",
        "kosmetyku dobranego do masażu i wrażliwości skóry.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Przed masażem pytamy o stan skóry, alergie oraz niedawne procedury kosmetyczne i estetyczne. Aktywne infekcje, opryszczka i silne podrażnienie są przeciwwskazaniem do sesji.",
    },
    seoPhrases: [
      "masaż kosmetyczny twarzy Wrocław",
      "masaż twarzy Wrocław",
      "pielęgnacyjny masaż twarzy Wrocław",
      "masaż twarzy Zakrzów",
    ],
    booking: {
      title: "Zaopiekuj się twarzą",
      description:
        "Zarezerwuj masaż kosmetyczny i daj skórze chwilę prawdziwego odprężenia.",
    },
    relatedMassageIds: ["face-neck", "face-lifting", "lymphatic-face"],
  }),

  "face-lifting": createPage("face-lifting", {
    description: [
      {
        paragraphs: [
          "Masaż liftingujący wykorzystuje bardziej energiczne i precyzyjne techniki niż klasyczny masaż kosmetyczny. Nie oznacza to jednak mocnego rozciągania skóry ani pracy powodującej dyskomfort. Podczas sesji koncentrujemy się na obszarach, które wpływają na napięcie i wyraz twarzy: policzkach, linii żuchwy, czole, skroniach oraz okolicy ust. W zależności od potrzeb możemy uwzględnić również fragment szyi, aby nie kończyć pracy gwałtownie przy dolnej linii twarzy. Intensywność dobieramy do kondycji i wrażliwości skóry. Masaż może dawać uczucie pobudzenia, większej lekkości oraz rozluźnienia mimiki. Bezpośrednio po sesji twarz może wyglądać na bardziej wypoczętą, ale efekt nie jest trwałym liftingiem ani odpowiednikiem procedury medycyny estetycznej. Ta usługa różni się od masażu kosmetycznego większą aktywnością technik oraz mocniejszym skupieniem na konturze i napięciu twarzy.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób chcących bardziej aktywnego masażu twarzy;",
        "dla osób czujących napięcie żuchwy, policzków lub czoła;",
        "dla osób oczekujących pobudzenia skóry;",
        "dla osób, które nie mają przeciwwskazań do intensywniejszej pracy.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "bardziej aktywnych technik niż w masażu kosmetycznym;",
        "pracy z policzkami, żuchwą, czołem i skroniami;",
        "odprężenia napiętej mimiki;",
        "przejściowego pobudzenia i zaróżowienia skóry.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Konieczne jest zachowanie odstępu po toksynie botulinowej, wypełniaczach, niciach, zabiegach laserowych i innych procedurach estetycznych. Termin masażu ustalamy z uwzględnieniem zaleceń osoby wykonującej dany zabieg.",
    },
    seoPhrases: [
      "masaż liftingujący twarzy Wrocław",
      "masaż modelujący twarzy Wrocław",
      "liftingujący masaż twarzy Wrocław",
      "masaż twarzy Zakrzów",
    ],
    booking: {
      title: "Przywróć twarzy napięcie i spokój",
      description:
        "Zarezerwuj masaż liftingujący i poczuj precyzyjną pracę z owalem.",
    },
    relatedMassageIds: ["face-neck", "cosmetic-face", "face-cupping"],
  }),

  "face-neck": createPage("face-neck", {
    description: [
      {
        paragraphs: [
          "Twarz nie funkcjonuje w oderwaniu od szyi i dekoltu. Napięcie w okolicy żuchwy może łączyć się ze sztywnością szyi, a długotrwała pozycja przy komputerze wpływa również na sposób ustawienia głowy i barków.",
          "Ta sesja obejmuje szerszy obszar niż masaż kosmetyczny twarzy. Pracujemy z twarzą, szyją i dekoltem, zwracając uwagę na miejsca, które mogą wpływać na odczuwanie napięcia w całej okolicy.",
          "Masaż może mieć przede wszystkim charakter odprężający lub pielęgnacyjny. Ruchy dobieramy do wrażliwości skóry i budowy szyi. Nie stosujemy mocnego nacisku na przednią część szyi ani przypadkowych, intensywnych technik.",
          "To dobra propozycja dla osób, które chcą połączyć masaż twarzy z pełniejszym rozluźnieniem sąsiednich obszarów. W porównaniu z masażem kosmetycznym sesja jest dłuższa i obejmuje większy zakres.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób odczuwających napięcie twarzy i szyi;",
        "dla osób pracujących długo przy komputerze;",
        "dla osób chcących połączyć pielęgnację twarzy, szyi i dekoltu;",
        "dla osób, którym zależy na pełniejszej sesji niż masaż samej twarzy.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "pracy z twarzą, szyją i dekoltem;",
        "odprężenia okolicy żuchwy i napiętej mimiki;",
        "spokojnych, płynnych ruchów;",
        "kosmetyku dopasowanego do obszaru masażu.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Przed sesją pytamy o choroby tarczycy, stan węzłów chłonnych, zabiegi w obrębie szyi oraz świeże procedury kosmetyczne i estetyczne. Praca w przedniej części szyi pozostaje delikatna.",
    },
    seoPhrases: [
      "masaż twarzy szyi i dekoltu Wrocław",
      "masaż szyi i dekoltu Wrocław",
      "masaż twarzy Wrocław",
      "masaż twarzy Zakrzów",
    ],
    booking: {
      title: "Zaopiekuj się twarzą, szyją i dekoltem",
      description:
        "Zarezerwuj kompleksowy masaż i daj tym obszarom wspólną uwagę.",
    },
    relatedMassageIds: ["face-lifting", "cosmetic-face", "classic-back"],
  }),

  "face-cupping": createPage("face-cupping", {
    description: [
      {
        paragraphs: [
          "Bańka stosowana na twarzy wymaga zupełnie innego podejścia niż bańka przeznaczona do masażu ciała. Podciśnienie jest znacznie delikatniejsze, a bańka nie powinna pozostawać nieruchomo w jednym miejscu.",
          "Przed masażem nakładamy odpowiedni preparat zapewniający poślizg. Następnie pracujemy małą bańką na policzkach, linii żuchwy, czole lub innych wybranych obszarach. Omijamy okolice bardzo wrażliwe, aktywne zmiany skórne oraz miejsca, w których naczynia są wyraźnie osłabione. Celem nie jest wywołanie siniaków ani mocnego zaczerwienienia. Pracujemy z lekkim podciśnieniem i płynnym ruchem, aby ograniczyć ryzyko nadmiernego podrażnienia. Mimo ostrożności bezpośrednio po masażu może pojawić się przejściowe zaróżowienie skóry. Masaż może wspierać chwilowe pobudzenie skóry i odprężenie twarzy. Nie obiecujemy spłycenia zmarszczek, trwałej poprawy owalu ani efektu porównywalnego z procedurami estetycznymi.",
        ],
      },
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób chcących poznać delikatny masaż twarzy bańką;",
        "dla osób preferujących lekkie pobudzenie skóry;",
        "dla osób bez aktywnych zmian i znacznej kruchości naczyń;",
        "dla osób szukających alternatywy dla masażu manualnego.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "pracy małą bańką;",
        "lekkiego podciśnienia;",
        "stałego, płynnego ruchu;",
        "możliwego przejściowego zaróżowienia skóry;",
        "krótkiej oceny wrażliwości skóry przed masażem.",
      ],
    },
    safety: {
      title: "Informacja bezpieczeństwa",
      description:
        "Masażu nie wykonujemy przy aktywnym trądziku różowatym, opryszczce, stanie zapalnym, nasilonych zmianach naczyniowych, zaburzeniach krzepnięcia, dużej skłonności do siniaków ani bezpośrednio po procedurach estetycznych.",
    },
    seoPhrases: [
      "masaż twarzy bańką Wrocław",
      "masaż bańką twarzy Wrocław",
      "bańki do twarzy Wrocław",
      "masaż twarzy Zakrzów",
    ],
    booking: {
      title: "Rozluźnij tkanki twarzy inaczej",
      description:
        "Zarezerwuj masaż bańką na twarz i poczuj subtelną pracę z powięzią.",
    },
    relatedMassageIds: ["face-lifting", "cupping", "cosmetic-face"],
  }),

  "vip-ritual": createPage("vip-ritual", {
    tagline: "Kilka godzin poza codziennością",
    description: [
      {
        paragraphs: [
          "Są chwile, w których ciało potrzebuje czegoś więcej niż odpoczynku pomiędzy kolejnymi obowiązkami. Potrzebuje czasu. Ciepła. Dotyku prowadzonego bez pośpiechu i przestrzeni, w której przez kilka godzin nie trzeba być nigdzie indziej.",
          "ORHEA VIP to najbardziej rozbudowany rytuał w naszej ofercie. Stworzony dla jednej osoby i jej aktualnych potrzeb. Łączy pielęgnację skóry, ciepło sauny infrared, długi masaż całego ciała oraz relaksacyjny masaż twarzy. Poszczególne etapy następują po sobie spokojnie, bez gwałtownych przejść i patrzenia na zegarek.",
          "To czas troski o ciało, ale również o to, co na co dzień pozostaje napięte i niewypowiedziane. Zmęczenie, nadmiar bodźców, ciągła gotowość. W ORHEA można na kilka godzin odłożyć je na bok.",
        ],
      },
      {
        title: "Rytuał rozpoczyna się od ciszy",
        paragraphs: [
          "Po wejściu do przygotowanej przestrzeni otrzymujesz czas tylko dla siebie. Możesz wziąć prysznic, spokojnie przygotować się do rytuału i pozwolić, aby tempo dnia stopniowo zwolniło.",
          "Pierwszym etapem jest peeling całego ciała. Delikatne głaskanie i rozcieranie łączymy z pielęgnacją skóry, usuwając jej szorstkość i przygotowując ją na kolejne części rytuału. Dotyk pozostaje łagodny. Nie chodzi o pośpiech ani intensywne złuszczanie, ale o przywrócenie skórze miękkości i świeżości.",
          "Następnie przychodzi czas na ciepło sauny infrared. Pierwsza sesja pozwala spokojnie ogrzać ciało przed masażem. Po niej możesz odpocząć, napić się wody i pozostać przez chwilę w ciszy.",
        ],
      },
      {
        title: "Półtorej godziny uważnego masażu",
        paragraphs: [
          "Centralnym punktem rytuału jest 90-minutowy masaż klasyczny całego ciała.",
          "To długi, niespieszny masaż, podczas którego nie trzeba wybierać pomiędzy plecami, nogami, karkiem czy ramionami. Jest czas, aby objąć pracą całe ciało, a jednocześnie zatrzymać się dłużej w miejscach, które najbardziej potrzebują uwagi.",
          "Intensywność dopasowujemy do Ciebie. Masaż może być bardziej zdecydowany tam, gdzie czujesz przeciążenie, i łagodniejszy w obszarach, które potrzebują przede wszystkim odpoczynku. Ruchy stają się spokojniejsze wraz z ciałem. Oddech stopniowo się wyrównuje, a napięcie nie musi być już utrzymywane.",
          "Po masażu czeka na Ciebie druga sesja w saunie infrared. To moment, w którym nie trzeba od razu wracać do ruchu. Możesz jeszcze przez chwilę pozostać w cieple, a następnie odpocząć tyle, ile potrzebujesz.",
        ],
      },
      {
        title: "Twarz, która również potrzebuje odpoczynku",
        paragraphs: [
          "Ostatnia część masażowa obejmuje twarz, skronie, czoło, policzki, żuchwę i szyję.",
          "Przez 30 minut spokojny, relaksacyjny dotyk pomaga odprężyć mimikę i miejsca, w których często nieświadomie utrzymujemy napięcie. Ruchy są miękkie i prowadzone bez pośpiechu. Twarz odzyskuje bardziej wypoczęty wygląd, a cały rytuał stopniowo przechodzi w wyciszenie.",
        ],
      },
      {
        title: "Pielęgnacyjne zakończenie",
        paragraphs: [
          "Na zakończenie możesz ponownie skorzystać z prysznica. Następnie na całe ciało i twarz nakładamy dobrany krem nawilżający lub odżywczy.",
          "Nie kończymy rytuału w chwili, w której ustaje masaż. Pozostaje jeszcze czas na pielęgnację, spokojne ubranie się i powrót do codzienności we własnym tempie.",
          "Bez pośpiechu. Bez kolejnej osoby czekającej za drzwiami. Bez poczucia, że wyjątkowy moment właśnie został nagle przerwany.",
        ],
      },
    ],
    forWhom: {
      title: "ORHEA VIP jest dla Ciebie, jeśli…",
      items: [
        "Potrzebujesz czegoś więcej niż standardowej wizyty na masażu. Chcesz na kilka godzin odłączyć się od codzienności, poczuć opiekę i pozwolić sobie na odpoczynek, który obejmuje całe ciało.",
        "To rytuał na ważny moment. Może być prezentem, sposobem na uczczenie osobistej okazji albo świadomym wyborem dla siebie. Bez konieczności czekania na szczególny powód.",
      ],
    },
    expectations: {
      title: "Przebieg ORHEA VIP",
      items: VIP_RITUAL_STEPS.map((step) => step.description),
    },
    safety: {
      title: "Zanim rozpocznie się rytuał",
      description:
        "Przed sesją przeprowadzamy rozmowę dotyczącą samopoczucia, kondycji skóry, tolerancji ciepła i ewentualnych przeciwwskazań. Długość pobytu w saunie oraz intensywność masażu dopasowujemy indywidualnie. Każdy etap może zostać zmodyfikowany, jeśli w danym dniu Twoje ciało potrzebuje czegoś innego.",
    },
    seoPhrases: [],
    steps: VIP_RITUAL_STEPS,
    booking: {
      title: "Zarezerwuj rytuał ORHEA VIP",
      description:
        "Rytuał VIP ORHEA to czas wyłącznie dla Ciebie. Umów termin i wejdź w pełne wyciszenie.",
    },
    relatedMassageIds: ["orhea-ritual", "hot-stone", "chocolate-ritual"],
  }),
};

export const massagePages: MassagePageContent[] = massages.map((massage) => {
  const page = massagePageById[massage.id];
  if (!page)
    throw new Error(`Massage page: brak contentu dla "${massage.id}".`);
  return page;
});

export const getMassagePageById = (massageId: MassageId) =>
  massagePageById[massageId];
export const getMassageOfferPath = (massage: Pick<Massage, "slug">) =>
  `/uslugi/${massage.slug}`;
export const getMassageBookingPath = (massage: Pick<Massage, "id">) =>
  `/rezerwacja?masaz=${massage.id}`;

export const resolveRelatedMassages = (
  massageId: MassageId,
  preferredIds: MassageId[] = [],
  limit = RELATED_LIMIT,
): Massage[] => {
  const currentMassage = getMassageById(massageId);
  const selected: Massage[] = [];
  const seen = new Set<MassageId>([massageId]);
  const add = (id: MassageId) => {
    if (selected.length >= limit || seen.has(id)) return;
    const massage = getMassageById(id);
    if (!massage || !massagePageById[id]) return;
    seen.add(id);
    selected.push(massage);
  };
  preferredIds.forEach(add);
  if (currentMassage)
    getMassagesByZoneId(currentMassage.zoneId).forEach((massage) =>
      add(massage.id),
    );
  massages.forEach((massage) => {
    if (massage.zoneId === "vip" && currentMassage?.zoneId !== "vip") return;
    add(massage.id);
  });
  return selected;
};
