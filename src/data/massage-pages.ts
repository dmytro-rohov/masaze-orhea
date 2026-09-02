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

export type MassagePageList = {
  title: string;
  items: string[];
};

export type MassagePageContent = {
  massageId: MassageId;
  description: string[];
  bodyVisual?: ImageMetadata;
  bodyVisualAlt?: string;
  forWhom: MassagePageList;
  expectations: MassagePageList;
  safety: {
    title: string;
    description: string;
  };
  booking: {
    title: string;
    description: string;
  };
  relatedMassageIds: MassageId[];
};

export const DEFAULT_MASSAGE_SAFETY = {
  title: "Informacje bezpieczeństwa",
  description:
    "Masaż nie zastępuje konsultacji lekarskiej ani fizjoterapeutycznej. Przed sesją przeprowadzamy krótki wywiad, aby dobrać masaż do Twoich potrzeb i wykluczyć podstawowe przeciwwskazania.",
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
  "massageId" | "safety" | "booking" | "bodyVisual" | "bodyVisualAlt"
> & {
  safety?: MassagePageContent["safety"];
  booking?: MassagePageContent["booking"];
  bodyVisual?: ImageMetadata;
  bodyVisualAlt?: string;
};

const createPage = (
  massageId: MassageId,
  draft: MassagePageDraft,
): MassagePageContent => {
  const massage = getMassageById(massageId);

  if (!massage) {
    throw new Error(`Massage page: brak masażu "${massageId}".`);
  }

  return {
    massageId,
    ...draft,
    bodyVisual: draft.bodyVisual ?? BODY_VISUAL_BY_ZONE[massage.zoneId],
    bodyVisualAlt: draft.bodyVisualAlt ?? massage.serviceName ?? massage.title,
    safety: draft.safety ?? DEFAULT_MASSAGE_SAFETY,
    booking: draft.booking ?? {
      title: `Zarezerwuj: ${massage.serviceName ?? massage.title}`,
      description: "Zarezerwuj masaż i poczuj różnicę już po jednej sesji.",
    },
  };
};

export const massagePageById: Record<MassageId, MassagePageContent> = {
  "classic-back": createPage("classic-back", {
    description: [
      "Długi dzień przy komputerze zostawia ślady nie tylko w głowie. Ciało często pamięta go jeszcze długo po zamknięciu laptopa. Kark robi się cięższy, barki trzymają napięcie, mięśnie przykręgosłupowe stają się sztywne, a dolna część pleców może dawać znać, że zbyt długo pozostawała w jednej pozycji.",
      "Ten masaż jest dla osób, które dużo siedzą i potrzebują konkretnej, spokojnej pracy z plecami, karkiem i barkami. Przed rozpoczęciem pytamy, gdzie czujesz największe przeciążenie i jak reagujesz na nacisk.",
      "Przy pracy siedzącej napięcie często kumuluje się nie tylko w karku i barkach, ale także w okolicy łopatek oraz dolnych pleców. Dlatego masaż może objąć kilka powiązanych obszarów zamiast skupiać się wyłącznie na jednym miejscu.",
      "Pracujemy klasycznymi technikami masażu, w tempie dobranym do Twojego ciała. Masaż może być spokojniejszy lub bardziej intensywny, ale powinien pozostawać w granicach Twojego komfortu.",
      "Po sesji ciało może być spokojniejsze, bardziej świadome i swobodniejsze w obszarach, które przez cały dzień pracowały w jednej pozycji.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które dużo pracują przy komputerze;",
        "dla osób, które czują napięcie w karku, barkach lub między łopatkami;",
        "dla osób, które po długim siedzeniu odczuwają przeciążenie pleców;",
        "dla osób, które chcą skupić masaż na plecach, karku i barkach;",
        "dla osób potrzebujących rozluźnienia po pracy albo intensywnym dniu.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "krótkiej rozmowy przed rozpoczęciem masażu;",
        "pracy z karkiem, barkami, plecami i okolicą łopatek;",
        "uwzględnienia innych obszarów, jeśli ciało tego potrzebuje;",
        "dopasowania intensywności do Twojego komfortu;",
        "uczucia większej swobody i rozluźnienia po sesji.",
      ],
    },
    booking: {
      title: "Zadbaj o swoje plecy, kark i barki",
      description: "Zarezerwuj masaż i poczuj różnicę już po jednej sesji.",
    },
    relatedMassageIds: ["desk-relief", "classic-body", "tension-relief"],
  }),

  "desk-relief": createPage("desk-relief", {
    description: [
      "Praca siedząca rzadko obciąża tylko jeden mięsień. Po kilku godzinach przy biurku napięcie zbiera się w karku, barkach, między łopatkami i często schodzi niżej, aż do dolnych pleców.",
      "Ten masaż jest dłuższy i bardziej kompleksowy niż skupiona praca wyłącznie z plecami. Daje czas, żeby spokojnie przejść przez obszary, które najbardziej odczuwają skutki siedzenia.",
      "Przed sesją pytamy, w jakiej pozycji spędzasz dzień i gdzie ciało najczęściej daje znać o zmęczeniu. Dzięki temu masaż nie jest szablonem, tylko odpowiedzią na Twój rytm pracy.",
      "Techniki klasyczne łączymy z tempem, które pozwala rozluźnić tkanki bez pośpiechu. Jeśli potrzebujesz mocniejszej pracy, dopasowujemy nacisk tak, by pozostał komfortowy.",
      "Po masażu wiele osób odczuwa lżejsze barki, swobodniejszy kark i większą łatwość w powrocie do wyprostowanej, mniej spiętej postawy.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób spędzających większość dnia przy biurku;",
        "dla osób z napiętymi barkami, karkiem i okolicą łopatek;",
        "dla osób, które po pracy czują sztywność pleców;",
        "dla osób szukających dłuższej, spokojnej sesji po siedzeniu;",
        "dla osób, które chcą regularnie rozładowywać przeciążenie z pracy.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "uwzględnienia Twojej pozycji przy biurku i codziennych nawyków;",
        "pracy z plecami, karkiem, barkami i powiązanymi obszarami;",
        "spokojnego tempa z możliwością mocniejszego nacisku;",
        "krótkich przerw na oddech, jeśli ciało tego potrzebuje;",
        "uczucia rozluźnienia po długim dniu w pozycji siedzącej.",
      ],
    },
    booking: {
      title: "Rozluźnij ciało po dniu przy biurku",
      description:
        "Zarezerwuj godzinę dla barków, karku i pleców, które noszą Twoją pracę.",
    },
    relatedMassageIds: ["classic-back", "tension-relief", "classic-body"],
  }),

  "classic-body": createPage("classic-body", {
    description: [
      "Gdy zmęczenie nie kończy się na jednym miejscu, ciało potrzebuje szerszej, spokojnej pracy. Masaż klasyczny całego ciała pozwala przejść przez główne grupy mięśni i dać im wspólną chwilę oddechu.",
      "Sesja obejmuje nogi, plecy, ramiona i kark, a tempo dostosowujemy do tego, jak reagujesz na dotyk. Możesz przyjść po treningu, po intensywnym tygodniu albo po prostu po potrzebę regeneracji.",
      "Przed rozpoczęciem pytamy, które obszary są dziś najważniejsze. Dzięki temu całościowa praca nadal ma kierunek i nie rozmywa się w przypadkowym masażu.",
      "Korzystamy z klasycznych technik ugniatania, rozcierania i głaskania. Intensywność pozostaje w granicach komfortu, nawet jeśli prosisz o głębszą pracę.",
      "Po sesji ciało często czuje się bardziej jednolite: mniej spięte w pojedynczych punktach i gotowe na spokojniejszy wieczór albo lżejszy następny dzień.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które chcą masażu całego ciała, a nie tylko jednego obszaru;",
        "dla osób po treningu, podróży albo intensywnym tygodniu;",
        "dla osób szukających klasycznej, sprawdzonej pracy z mięśniami;",
        "dla osób, które potrzebują zarówno rozluźnienia, jak i regeneracji;",
        "dla osób, które lubią spokojny, kompletny rytm sesji.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "pracy z całym ciałem w logicznej, spokojnej kolejności;",
        "większego skupienia na obszarach, które wskażesz;",
        "klasycznych technik dopasowanych do Twojego komfortu;",
        "możliwości zmiany nacisku w trakcie sesji;",
        "uczucia ogólnego odprężenia i większej swobody ruchu.",
      ],
    },
    booking: {
      title: "Daj całemu ciału godzinę spokoju",
      description:
        "Zarezerwuj masaż klasyczny i pozwól mięśniom wrócić do równowagi.",
    },
    relatedMassageIds: ["tension-relief", "relaxing-body", "classic-back"],
  }),

  "tension-relief": createPage("tension-relief", {
    description: [
      "Napięcie rzadko rozkłada się równo. U jednych zbiera się w karku, u innych w barkach, biodrach albo w miejscach, które od dawna pracują ponad miarę.",
      "Ten masaż jest ukierunkowany. Zamiast przechodzić schematycznie przez całe ciało, więcej czasu poświęcamy obszarom, które dziś najbardziej potrzebują uwagi.",
      "Rozmowa na początku sesji jest tu szczególnie ważna. Pytamy, gdzie czujesz opór, co nasila dyskomfort i jak mocnej pracy oczekujesz.",
      "Pracujemy klasycznymi technikami, ale z większą precyzją i cierpliwością wobec tkanek, które trzymają napięcie. Jeśli ciało potrzebuje łagodniejszego tempa, zwalniamy.",
      "Celem nie jest „rozbicie” mięśni za wszelką cenę, tylko spokojne przywrócenie im większej swobody i komfortu w codziennym ruchu.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób z powtarzającym się napięciem w konkretnych obszarach;",
        "dla osób, które chcą głębszej, bardziej ukierunkowanej pracy;",
        "dla osób po stresie, treningu albo długim unieruchomieniu;",
        "dla osób, którym ogólny masaż całego ciała bywa zbyt rozproszony;",
        "dla osób gotowych powiedzieć, gdzie ciało najbardziej prosi o uwagę.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "dokładniejszego wywiadu o miejscach napięcia;",
        "pracy skupionej na wybranych obszarach;",
        "głębszego nacisku tylko tam, gdzie jest to komfortowe;",
        "elastycznego planu sesji zamiast sztywnego schematu;",
        "uczucia ulgi w miejscach, które zwykle zostają spięte.",
      ],
    },
    booking: {
      title: "Pracuj tam, gdzie napięcie zbiera się najczęściej",
      description:
        "Zarezerwuj masaż ukierunkowany i daj ciału konkretną, spokojną uwagę.",
    },
    relatedMassageIds: ["classic-body", "desk-relief", "cupping"],
  }),

  cupping: createPage("cupping", {
    description: [
      "Masaż bańką chińską to dynamiczna praca z tkankami, która łączy mobilność mięśni z pielęgnacyjnym charakterem dla skóry. Bańka unosi tkanki i pozwala pracować z nimi w inny sposób niż klasyczny nacisk dłonią.",
      "Sesja sprawdza się tam, gdzie ciało czuje się zbite, mniej elastyczne albo potrzebuje intensywniejszego bodźca. Nadal dopasowujemy siłę do Twojej wrażliwości.",
      "Przed rozpoczęciem omawiamy obszary pracy i to, jak skóra oraz tkanki zwykle reagują na bodźce. Nie każda okolica potrzebuje tej samej intensywności.",
      "Technika może pozostawić przejściowe ślady na skórze. Informujemy o tym wcześniej, żebyś wiedziała lub wiedział, czego się spodziewać.",
      "Po masażu wiele osób odczuwa większą ruchomość tkanek, przyjemne ciepło i wrażenie, że skóra oraz mięśnie pracują swobodniej.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które chcą pracy z tkanką i jędrnością skóry;",
        "dla osób lubiących bardziej dynamiczny masaż;",
        "dla osób czujących zbitą, mniej elastyczną tkankę;",
        "dla osób, którym klasyczny masaż bywa niewystarczający;",
        "dla osób świadomych, że na skórze mogą pojawić się przejściowe ślady.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "omówienia obszarów i intensywności pracy bańką;",
        "dynamicznego unoszenia i przesuwania tkanek;",
        "możliwych, przejściowych śladów na skórze;",
        "dopasowania siły do Twojego komfortu;",
        "uczucia większej mobilności i ciepła po sesji.",
      ],
    },
    booking: {
      title: "Daj tkankom inną jakość ruchu",
      description:
        "Zarezerwuj masaż bańką chińską i poczuj bardziej dynamiczną pracę z ciałem.",
    },
    relatedMassageIds: ["tension-relief", "classic-body", "face-cupping"],
  }),

  "relaxing-body": createPage("relaxing-body", {
    description: [
      "Nie każdy masaż musi być głęboki, żeby był potrzebny. Czasem ciało prosi przede wszystkim o zwolnienie tempa, wyciszenie układu nerwowego i przyjemny, przewidywalny rytm.",
      "Masaż relaksacyjny całego ciała jest spokojniejszy, bardziej otulający i nastawiony na odprężenie. Pracujemy wolniej, z dbałością o atmosferę i ciągłość ruchu.",
      "To dobra propozycja po stresie, bezsenności albo tygodniu, w którym trudno było zwolnić. Nie musisz wiedzieć, który mięsień jest spięty. Wystarczy, że chcesz odpocząć.",
      "Techniki pozostają łagodne, ale nie przypadkowe. Nadal słuchamy ciała i omijamy miejsca, które wymagają ostrożności.",
      "Po sesji często pojawia się wrażenie ciężkości powiek, głębszego oddechu i miękkiego zmęczenia, które sprzyja regeneracji.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które chcą wyciszenia, a nie intensywnej pracy;",
        "dla osób po stresie, napiętym tygodniu albo trudnym śnie;",
        "dla osób lubiących spokojny masaż całego ciała;",
        "dla osób, które dopiero zaczynają przygodę z masażem;",
        "dla osób szukających prezentu w postaci prawdziwego odpoczynku.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "wolniejszego, otulającego rytmu pracy;",
        "masaży całego ciała bez nacisku na intensywność;",
        "spokojnej atmosfery i dbałości o komfort;",
        "możliwości poproszenia o mocniejszy lub lżejszy dotyk;",
        "uczucia wyciszenia i gotowości do odpoczynku po sesji.",
      ],
    },
    booking: {
      title: "Pozwól ciału zwolnić",
      description:
        "Zarezerwuj masaż relaksacyjny i daj sobie godzinę prawdziwego wyciszenia.",
    },
    relatedMassageIds: ["hot-stone", "classic-body", "orhea-ritual"],
  }),

  "hot-stone": createPage("hot-stone", {
    description: [
      "Ciepło zmienia jakość masażu. Rozgrzane kamienie pomagają tkankom złagodnieć, a ciału łatwiej oddać napięcie, które w chłodzie bywa bardziej oporne.",
      "Masaż ciepłymi kamieniami łączy klasyczną pracę dłoni z przyjemnym, prowadzącym ciepłem. Kamienie mogą spoczywać na ciele albo być włączane w ruch masażu.",
      "To dłuższa sesja stworzona z myślą o głębokim odprężeniu. Sprawdza się, gdy potrzebujesz nie tylko rozluźnienia mięśni, ale też poczucia, że ciało naprawdę odpoczywa.",
      "Przed zabiegiem pytamy o wrażliwość na ciepło i miejsca, które wymagają ostrożności. Temperatura kamieni zawsze pozostaje pod kontrolą.",
      "Po rytuale często zostaje wrażenie rozlania się ciepła, ciężkości powiek i spokojniejszego oddechu, które trudno uzyskać w krótszej, dynamicznej sesji.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które kochają ciepło i dłuższy rytuał regeneracji;",
        "dla osób z napięciem, które trudno oddać w pośpiechu;",
        "dla osób szukających głębokiego odprężenia;",
        "dla osób, które chcą połączyć masaż z elementem rytuału;",
        "dla osób planujących prezent o wyjątkowym charakterze.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "dłuższej, 90-minutowej sesji;",
        "pracy dłoni wspieranej ciepłem kamieni;",
        "omówienia wrażliwości na temperaturę;",
        "spokojnego, otulającego tempa;",
        "głębokiego poczucia relaksu po zakończeniu.",
      ],
    },
    booking: {
      title: "Zregeneruj ciało w cieple",
      description:
        "Zarezerwuj masaż kamieniami i zostań w rytuale dłużej niż zwykle.",
    },
    relatedMassageIds: ["orhea-ritual", "relaxing-body", "honey-ritual"],
  }),

  "chocolate-ritual": createPage("chocolate-ritual", {
    description: [
      "Niektóre sesje mają być nie tylko masażem, ale też pielęgnacyjnym doświadczeniem. Czekoladowy rytuał otula ciało zapachem, konsystencją kosmetyków i spokojną pracą dłoni.",
      "Łączymy masaż z pielęgnacyjnym charakterem składników inspirowanych czekoladą. To propozycja dla osób, które chcą odprężenia i poczucia, że skóra też zostaje zaopiekowana.",
      "Rytuał trwa dłużej niż klasyczna godzina. Dajemy czas na nałożenie kosmetyków, pracę z ciałem i moment, w którym nic nie trzeba przyspieszać.",
      "Przed sesją pytamy o wrażliwość skóry i zapachów. Jeśli coś Ci nie służy, dostosowujemy przebieg rytuału.",
      "Po zabiegu ciało często czuje się miękkie, odżywione i wyraźnie oderwane od codziennego tempa.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które chcą masażu z elementem pielęgnacji;",
        "dla osób lubiących rytuały, zapach i otulającą atmosferę;",
        "dla osób szukających wyjątkowego prezentu;",
        "dla osób, które chcą dłuższej, spokojnej sesji;",
        "dla osób pragnących odprężenia bez intensywnej pracy głębokiej.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "90 minut rytuału łączącego masaż i pielęgnację;",
        "kosmetyków o czekoladowym charakterze;",
        "spokojnego, zmysłowego tempa pracy;",
        "dbałości o komfort skóry i zapachu;",
        "uczucia odżywienia i miękkiego relaksu po sesji.",
      ],
    },
    booking: {
      title: "Otul ciało czekoladowym rytuałem",
      description:
        "Zarezerwuj sesję, która łączy masaż z pielęgnacją i chwilą przyjemności.",
    },
    relatedMassageIds: ["honey-ritual", "orhea-ritual", "relaxing-body"],
  }),

  "honey-ritual": createPage("honey-ritual", {
    description: [
      "Rytuał miodowy jest rozgrzewający i odżywczy. Łączy masaż z pielęgnacją, która ma dać ciału poczucie komfortu, miękkości i regeneracji.",
      "Między klasyczną pracą z mięśniami pojawia się element rytuału: ciepło, faktura kosmetyku i wolniejsze tempo, które sprzyja odprężeniu.",
      "To dobra propozycja na chłodniejsze dni, po zmęczeniu albo wtedy, gdy chcesz czegoś więcej niż samego masażu technicznego.",
      "Przed zabiegiem pytamy o alergie, wrażliwość skóry i oczekiwania wobec intensywności. Rytuał pozostaje przyjemny, nie inwazyjny.",
      "Po sesji skóra często wydaje się bardziej zadbana, a ciało cieplejsze i spokojniejsze.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które lubią rozgrzewające, odżywcze rytuały;",
        "dla osób szukających masażu z pielęgnacją;",
        "dla osób po zmęczeniu, chłodzie albo intensywnym okresie;",
        "dla osób planujących wyjątkowy prezent;",
        "dla osób, które chcą dłuższej sesji regeneracji.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "połączenia masażu z pielęgnacyjnym rytuałem;",
        "rozgrzewającego, spokojnego tempa;",
        "uwzględnienia wrażliwości skóry;",
        "90 minut poświęconych komfortowi ciała;",
        "uczucia miękkości, ciepła i odżywienia po zabiegu.",
      ],
    },
    booking: {
      title: "Rozgrzej i odżyw ciało",
      description: "Zarezerwuj rytuał miodowy i zostań w cieple dłużej.",
    },
    relatedMassageIds: ["chocolate-ritual", "hot-stone", "orhea-ritual"],
  }),

  "orhea-ritual": createPage("orhea-ritual", {
    description: [
      "Rytuał głębokiej regeneracji ORHEA jest autorskim połączeniem różnych elementów pracy z ciałem. Nie trzyma się jednej techniki, tylko składa sesję w spójne, dłuższe doświadczenie.",
      "Może łączyć spokojniejszy rytm relaksu z bardziej świadomą pracą tam, gdzie ciało tego potrzebuje. Celem jest regeneracja, nie pośpiech.",
      "To propozycja dla osób, które chcą czegoś więcej niż pojedynczego masażu z cennika. Rytuał ma swój przebieg, atmosferę i czas, żeby naprawdę zejść z tempa dnia.",
      "Na początku pytamy, czego dziś potrzebujesz: wyciszenia, rozluźnienia, ciepła czy szerszej regeneracji. Na tej podstawie prowadzimy sesję.",
      "Po 90 minutach ciało często czuje się zaopiekowane całościowo: mięśnie, oddech i nastrój mają szansę ułożyć się na nowo.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które chcą autorskiego rytuału ORHEA;",
        "dla osób potrzebujących głębszej, dłuższej regeneracji;",
        "dla osób, którym zależy na spójnym doświadczeniu, nie jednej technice;",
        "dla osób szukających wyjątkowej sesji dla siebie albo na prezent;",
        "dla osób gotowych zwolnić na pełne 90 minut.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "autorskiego połączenia technik i rytmu pracy;",
        "dłuższej, 90-minutowej sesji regeneracji;",
        "dostosowania przebiegu do Twoich potrzeb;",
        "spokojnej, dopracowanej atmosfery;",
        "poczucia kompleksowego odpoczynku po rytuale.",
      ],
    },
    booking: {
      title: "Wejdź w rytuał głębokiej regeneracji",
      description:
        "Zarezerwuj autorską sesję ORHEA i daj ciału pełne 90 minut uwagi.",
    },
    relatedMassageIds: ["hot-stone", "vip-ritual", "relaxing-body"],
  }),

  "lymphatic-body": createPage("lymphatic-body", {
    description: [
      "Drenaż limfatyczny jest delikatny, rytmiczny i bardzo inny od klasycznego ugniatania. Zamiast głębokiego nacisku pojawia się lekka, powtarzalna praca wspierająca poczucie lekkości.",
      "Sesja całego ciała sprawdza się, gdy czujesz ociężałość, opuchnięcie albo potrzebujesz spokojnego bodźca, który nie przeciąża tkanek.",
      "Technika wymaga precyzji i cierpliwości. Pracujemy powoli, zgodnie z kierunkiem naturalnego drenażu, bez pośpiechu i bez zbędnej siły.",
      "Przed zabiegiem zbieramy wywiad, ponieważ drenaż nie jest odpowiedni w każdej sytuacji. Jeśli coś budzi wątpliwość, spokojnie o tym rozmawiamy.",
      "Po sesji wiele osób opisuje wrażenie lekkości, mniejszego napięcia w nogach i tułowiu oraz przyjemnego wyciszenia.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób szukających uczucia lekkości całego ciała;",
        "dla osób, które nie chcą głębokiego, mocnego masażu;",
        "dla osób czujących ociężałość albo stagnację;",
        "dla osób lubiących rytmiczną, delikatną pracę;",
        "dla osób, które chcą wesprzeć codzienne poczucie komfortu ciała.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "bardzo delikatnego, rytmicznego masażu;",
        "pracy z całym ciałem w spokojnym tempie;",
        "krótkiego wywiadu przed rozpoczęciem;",
        "braku głębokiego ugniatania;",
        "uczucia lekkości i wyciszenia po sesji.",
      ],
    },
    booking: {
      title: "Przywróć ciału poczucie lekkości",
      description:
        "Zarezerwuj drenaż limfatyczny i daj sobie godzinę delikatnej pracy.",
    },
    relatedMassageIds: ["lymphatic-legs", "lymphatic-face", "relaxing-body"],
  }),

  "lymphatic-legs": createPage("lymphatic-legs", {
    description: [
      "Nogi często pierwsze dają znać o ciężkości dnia: po staniu, podróży, upale albo długim siedzeniu. Drenaż limfatyczny nóg skupia się właśnie na tym obszarze.",
      "Praca jest delikatna i rytmiczna. Nie chodzi o mocne ugniatanie łydek, tylko o spokojne wspieranie poczucia lekkości.",
      "Sesja trwa 45 minut, więc jest dobrym wyborem, gdy chcesz zaopiekować konkretny obszar bez masażu całego ciała.",
      "Przed zabiegiem pytamy o komfort nóg, codzienny tryb życia i ewentualne przeciwwskazania. Dzięki temu praca pozostaje bezpieczna i trafiona.",
      "Po drenażu nogi często wydają się lżejsze, mniej zmęczone i bardziej gotowe na resztę dnia.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób z uczuciem ciężkości nóg;",
        "dla osób po długim staniu, siedzeniu albo podróży;",
        "dla osób, które chcą skupić drenaż na nogach;",
        "dla osób lubiących delikatne, rytmiczne techniki;",
        "dla osób szukających krótszej, konkretnej sesji.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "pracy skoncentrowanej na nogach;",
        "delikatnego, rytmicznego drenażu;",
        "45 minut spokojnej, precyzyjnej sesji;",
        "wywiadu pod kątem komfortu i bezpieczeństwa;",
        "uczucia większej lekkości nóg po zabiegu.",
      ],
    },
    booking: {
      title: "Odciąż zmęczone nogi",
      description:
        "Zarezerwuj drenaż limfatyczny nóg i poczuj różnicę w codziennym komforcie.",
    },
    relatedMassageIds: ["lymphatic-body", "classic-body", "lymphatic-face"],
  }),

  "lymphatic-face": createPage("lymphatic-face", {
    description: [
      "Twarz też bywa ociężała: po śnie, stresie, długim dniu albo gdy mimika i napięcie zbierają się wokół oczu, żuchwy i policzków.",
      "Drenaż limfatyczny twarzy to subtelna, rytmiczna praca. Nie modeluje na siłę i nie przypomina intensywnego masażu liftingującego.",
      "Ruchy są lekkie, powtarzalne i prowadzone z dużą uwagą. Celem jest odprężenie oraz naturalne poczucie lekkości, nie spektakularna korekta.",
      "Przed sesją pytamy o wrażliwość skóry, zatoki, soczewki i codzienny komfort twarzy. Dostosowujemy nacisk do bardzo delikatnej okolicy.",
      "Po zabiegu twarz często wygląda na bardziej wypoczętą, a uczucie napięcia wokół oczu czy żuchwy bywa wyraźnie mniejsze.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób szukających lekkości i odprężenia twarzy;",
        "dla osób, które nie chcą intensywnego masażu liftingującego;",
        "dla osób czujących ociężałość, zmęczenie albo napięcie mimiczne;",
        "dla osób lubiących subtelne, rytmiczne techniki;",
        "dla osób, które chcą zadbać o twarz bez agresywnych bodźców.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "bardzo delikatnej pracy z twarzą;",
        "rytmicznego drenażu zamiast głębokiego ugniatania;",
        "uwzględnienia wrażliwości skóry i okolic oczu;",
        "45 minut skupionej, spokojnej sesji;",
        "uczucia lekkości i wypoczętego wyglądu po zabiegu.",
      ],
    },
    booking: {
      title: "Daj twarzy chwilę lekkości",
      description:
        "Zarezerwuj drenaż limfatyczny twarzy i poczuj subtelną różnicę.",
    },
    relatedMassageIds: ["cosmetic-face", "face-lifting", "lymphatic-body"],
  }),

  "cosmetic-face": createPage("cosmetic-face", {
    description: [
      "Masaż kosmetyczny twarzy łączy odprężenie z elementem pielęgnacji. To sesja dla osób, które chcą, żeby twarz odpoczęła, a skóra poczuła się zaopiekowana.",
      "Praca jest delikatna, ale świadoma. Przechodzimy przez mimikę, policzki, czoło i żuchwę, nie zapominając o komforcie skóry.",
      "To dobra propozycja, gdy nie szukasz mocnego liftingu, tylko przyjemnego masażu z pielęgnacyjnym charakterem.",
      "Przed zabiegiem pytamy o rodzaj skóry, wrażliwość i to, czy zależy Ci bardziej na relaksie, czy na wyraźniejszej pracy z twarzą.",
      "Po sesji skóra często wydaje się gładsza w odbiorze, a rysy twarzy łagodniejsze, jak po dobrze spędzonym czasie dla siebie.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które chcą połączyć masaż twarzy z pielęgnacją;",
        "dla osób szukających odprężenia, nie intensywnego liftingu;",
        "dla osób z napiętą mimiką albo zmęczoną skórą;",
        "dla osób, które lubią regularną troskę o twarz;",
        "dla osób szukających delikatnego zabiegu na prezent.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "delikatnego masażu twarzy z elementem pielęgnacji;",
        "pracy z mimiką, policzkami, czołem i żuchwą;",
        "dostosowania do wrażliwości skóry;",
        "spokojnego, przyjemnego tempa;",
        "uczucia odprężenia i zadbanej skóry po sesji.",
      ],
    },
    booking: {
      title: "Zaopiekuj się twarzą",
      description:
        "Zarezerwuj masaż kosmetyczny i daj skórze chwilę prawdziwego odprężenia.",
    },
    relatedMassageIds: ["face-neck", "face-lifting", "lymphatic-face"],
  }),

  "face-lifting": createPage("face-lifting", {
    description: [
      "Masaż liftingujący twarzy pracuje z mięśniami i tkankami bardziej świadomie niż klasyczny masaż kosmetyczny. Chodzi o odprężenie, ale też o lepsze napięcie i wyrazistość owalu.",
      "Technika jest precyzyjna. Nie szarpie skóry i nie obiecuje cudów, tylko wspiera naturalną pracę mięśni twarzy oraz komfort tkanek.",
      "Sesja trwa godzinę, więc jest czas, żeby przejść przez twarz spokojnie i dokładnie. Nacisk dopasowujemy do Twojej wrażliwości.",
      "Przed zabiegiem pytamy o oczekiwania, napięcie żuchwy, okolice oczu i to, jak skóra zwykle reaguje na masaż.",
      "Po sesji twarz często wydaje się bardziej wypoczęta, a owal i mimika zyskują wrażenie napięcia bez sztuczności.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które chcą ujędrnienia i odprężenia twarzy;",
        "dla osób czujących wiotkość albo spadek napięcia tkanek;",
        "dla osób z napiętą żuchwą albo zmęczoną mimiką;",
        "dla osób szukających bardziej precyzyjnej pracy niż masaż kosmetyczny;",
        "dla osób, które lubią godzinny, skupiony zabieg na twarz.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "precyzyjnej pracy z mięśniami i tkankami twarzy;",
        "większego nacisku niż w masażu kosmetycznym, nadal w komforcie;",
        "godziny poświęconej wyłącznie twarzy;",
        "uwzględnienia żuchwy, owalu i mimiki;",
        "wrażenia lepszego napięcia i odprężenia po sesji.",
      ],
    },
    booking: {
      title: "Przywróć twarzy napięcie i spokój",
      description:
        "Zarezerwuj masaż liftingujący i poczuj precyzyjną pracę z owalem.",
    },
    relatedMassageIds: ["face-neck", "cosmetic-face", "face-cupping"],
  }),

  "face-neck": createPage("face-neck", {
    description: [
      "Twarz, szyja i dekolt pracują razem. Napięcie żuchwy często schodzi do szyi, a zmęczenie dekoltu widać nie tylko w skórze, ale też w postawie barków.",
      "Ten masaż obejmuje wszystkie trzy obszary, zamiast zatrzymywać się wyłącznie na twarzy. Dzięki temu sesja jest bardziej kompletna.",
      "Pracujemy spokojnie, łącząc odprężenie mimiki z rozluźnieniem szyi i delikatną pielęgnacją dekoltu.",
      "Przed zabiegiem pytamy, który obszar jest dziś najważniejszy. Czasem więcej uwagi potrzebuje szyja, czasem żuchwa albo dekolt.",
      "Po godzinie wiele osób czuje lżejszą szyję, mniej zaciśniętą twarz i większy komfort w górnej części ciała.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które chcą kompleksowej pracy z twarzą, szyją i dekoltem;",
        "dla osób z napięciem żuchwy, karku albo barków;",
        "dla osób, którym masaż samej twarzy wydaje się niepełny;",
        "dla osób szukających odprężenia górnej części ciała;",
        "dla osób dbających o skórę dekoltu i szyi.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "pracy obejmującej twarz, szyję i dekolt;",
        "rozluźnienia napięć żuchwy i szyi;",
        "godziny spokojnej, kompletnej sesji;",
        "dostosowania nacisku do wrażliwych okolic;",
        "uczucia lekkości w górnej części ciała po zabiegu.",
      ],
    },
    booking: {
      title: "Zaopiekuj się twarzą, szyją i dekoltem",
      description:
        "Zarezerwuj kompleksowy masaż i daj tym obszarom wspólną uwagę.",
    },
    relatedMassageIds: ["face-lifting", "cosmetic-face", "classic-back"],
  }),

  "face-cupping": createPage("face-cupping", {
    description: [
      "Masaż bańką na twarzy to delikatna praca z powięzią i tkankami, dostosowana do wrażliwej okolicy. Bańka unosi skórę i pozwala pracować z nią inaczej niż samymi palcami.",
      "Technika wspiera mobilność tkanek i odprężenie, ale wymaga wyczucia. Nie kopiujemy intensywności bańki z ciała.",
      "Sesja trwa 45 minut i skupia się na twarzy. Dobrze sprawdza się, gdy czujesz zbitą tkankę, napiętą mimikę albo chcesz innego bodźca niż klasyczny masaż.",
      "Przed zabiegiem omawiamy wrażliwość skóry i możliwe, przejściowe zaczerwienienie. Pracujemy tylko tak, jak pozwala komfort.",
      "Po sesji twarz często wydaje się bardziej ruchoma, rozluźniona i wyraźniej odżywiona ruchem tkanek.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób, które chcą rozluźnić powięź i tkanki twarzy;",
        "dla osób lubiących pracę bańką w delikatnej wersji;",
        "dla osób czujących zbitą, mniej elastyczną tkankę twarzy;",
        "dla osób szukających innego bodźca niż masaż kosmetyczny;",
        "dla osób świadomych możliwej, przejściowej reakcji skóry.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "delikatnej pracy bańką dostosowaną do twarzy;",
        "unoszenia tkanek zamiast mocnego ugniatania;",
        "omówienia reakcji skóry przed zabiegiem;",
        "45 minut skupionej sesji;",
        "wrażenia większej mobilności i odprężenia twarzy.",
      ],
    },
    booking: {
      title: "Rozluźnij tkanki twarzy inaczej",
      description:
        "Zarezerwuj masaż bańką na twarz i poczuj subtelną pracę z powięzią.",
    },
    relatedMassageIds: ["face-lifting", "cupping", "cosmetic-face"],
  }),

  "vip-ritual": createPage("vip-ritual", {
    description: [
      "Rytuał VIP ORHEA jest najdłuższym doświadczeniem w ofercie. Trzy godziny dają przestrzeń, której nie da się zmieścić w standardowej sesji: na wyciszenie, pracę z ciałem, regenerację i prawdziwy komfort.",
      "To ekskluzywny rytuał stworzony dla osób, które chcą wyjątkowego dnia dla siebie albo ważnego prezentu. Nie jest skróconym masażem. Ma swój rytm, tempo i oprawę.",
      "Przebieg dopasowujemy do Ciebie. Możemy położyć akcent na relaks, regenerację, pracę z napięciem albo połączenie kilku jakości, których ciało dziś potrzebuje.",
      "Przed rytuałem rozmawiamy dłużej niż zwykle. Chcemy wiedzieć, jak ma wyglądać te trzy godziny, żeby były Twoje, a nie szablonowe.",
      "Po sesji zostaje wrażenie, że czas naprawdę się zatrzymał: ciało jest zaopiekowane, oddech spokojniejszy, a codzienność odsunięta na bezpieczną odległość.",
    ],
    forWhom: {
      title: "Dla kogo?",
      items: [
        "dla osób szukających wyjątkowego, wielogodzinnego rytuału;",
        "dla osób, które chcą pełnego komfortu i regeneracji;",
        "dla osób planujących prezent o premium charakterze;",
        "dla osób, którym standardowa godzina bywa za krótka;",
        "dla osób gotowych świadomie zatrzymać się na trzy godziny.",
      ],
    },
    expectations: {
      title: "Czego możesz się spodziewać?",
      items: [
        "180 minut autorskiego rytuału VIP;",
        "dłuższej rozmowy o tym, jak ma przebiegać sesja;",
        "połączenia regeneracji, relaksu i pracy z ciałem;",
        "wyjątkowej dbałości o komfort i atmosferę;",
        "poczucia głębokiego wyciszenia po zakończeniu.",
      ],
    },
    booking: {
      title: "Zarezerwuj wyjątkowe trzy godziny",
      description:
        "Rytuał VIP ORHEA to czas wyłącznie dla Ciebie. Umów termin i wejdź w pełne wyciszenie.",
    },
    relatedMassageIds: ["orhea-ritual", "hot-stone", "chocolate-ritual"],
  }),
};

export const massagePages: MassagePageContent[] = massages.map((massage) => {
  const page = massagePageById[massage.id];

  if (!page) {
    throw new Error(`Massage page: brak contentu dla "${massage.id}".`);
  }

  return page;
});

export const getMassagePageById = (massageId: MassageId) => {
  return massagePageById[massageId];
};

export const getMassageOfferPath = (massage: Pick<Massage, "slug">) => {
  return `/uslugi/${massage.slug}`;
};

export const getMassageBookingPath = (massage: Pick<Massage, "id">) => {
  return `/rezerwacja?masaz=${massage.id}`;
};

export const resolveRelatedMassages = (
  massageId: MassageId,
  preferredIds: MassageId[] = [],
  limit = RELATED_LIMIT,
): Massage[] => {
  const current = getMassageById(massageId);
  const selected: Massage[] = [];
  const seen = new Set<MassageId>([massageId]);

  const add = (id: MassageId) => {
    if (selected.length >= limit || seen.has(id)) {
      return;
    }

    const massage = getMassageById(id);

    if (!massage || !massagePageById[id]) {
      return;
    }

    seen.add(id);
    selected.push(massage);
  };

  preferredIds.forEach(add);

  if (current) {
    getMassagesByZoneId(current.zoneId).forEach((massage) => add(massage.id));
  }

  massages.forEach((massage) => {
    if (massage.zoneId === "vip" && current?.zoneId !== "vip") {
      return;
    }

    add(massage.id);
  });

  return selected;
};
