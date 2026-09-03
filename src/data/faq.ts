import type { AccordionItem } from "@/components/widgets/Accordion.astro";

import faqImage1 from "@/assets/img/faq-image.png";

export const faqCategories = [
  {
    id: "wybor-masazu",
    label: "Wybór masażu",
    description: "Pomoc w wyborze usługi dopasowanej do Twoich potrzeb i komfortu.",
  },
  {
    id: "przed-masazem",
    label: "Przed masażem",
    description: "Najważniejsze informacje przed pierwszą i kolejną wizytą.",
  },
  {
    id: "rezerwacja-i-terminy",
    label: "Rezerwacja i terminy",
    description: "Sposoby rezerwacji oraz informacje dotyczące terminów.",
  },
  {
    id: "miejsce-wizyty",
    label: "Miejsce wizyty",
    description: "Informacje o miejscu, w którym odbywają się masaże ORHEA.",
  },
  {
    id: "platnosci",
    label: "Płatności",
    description: "Informacje pomocne przed rozliczeniem wizyty.",
  },
  {
    id: "vouchery",
    label: "Vouchery",
    description: "Najważniejsze informacje dotyczące voucherów ORHEA.",
  },
  {
    id: "zmiana-i-anulowanie",
    label: "Zmiana i anulowanie",
    description: "Co zrobić, gdy plan wizyty wymaga zmiany.",
  },
] as const;

export type FaqCategoryId = (typeof faqCategories)[number]["id"];

export type FaqItem = AccordionItem & {
  id: string;
  categoryId: FaqCategoryId;
  popular?: boolean;
};

export const faqItems: FaqItem[] = [
  {
    id: "czy-sa-przeciwwskazania",
    categoryId: "wybor-masazu",
    title: "Czy są przeciwwskazania?",
    content: "Tak. Przeciwwskazania zależą od rodzaju masażu i aktualnego stanu zdrowia. Jeśli masz wątpliwości, skontaktuj się z nami przed wizytą.",
    image: faqImage1,
    imageAlt: "Nastrojowe wnętrze gabinetu ORHEA",
  },

  {
    id: "czy-masaz-boli",
    categoryId: "wybor-masazu",
    title: "Czy masaż boli?",
    content: "Dobry masaż to nie tortura. Pracujemy na granicy Twojego komfortu. Zawsze mówisz, gdy nacisk jest za mocny. Komunikacja to podstawa.",
    image: faqImage1,
    open: true,
  },

  {
    id: "jak-odwolac-wizyte",
    categoryId: "zmiana-i-anulowanie",
    popular: true,
    title: "Jak odwołać wizytę?",
    content: "Jeśli potrzebujesz odwołać lub przełożyć wizytę, skontaktuj się z nami możliwie jak najwcześniej.",
    image: faqImage1,
  },

  {
    id: "co-ubrac-na-masaz",
    categoryId: "przed-masazem",
    title: "Co ubrać na masaż?",
    content: "Przyjdź w wygodnym ubraniu. Przed zabiegiem wyjaśnimy, jak przygotować się do wybranego masażu.",
    image: faqImage1,
  },

  {
    id: "jak-przygotowac-sie-do-pierwszej-wizyty",
    categoryId: "przed-masazem",
    title: "Jak przygotować się do pierwszej wizyty?",
    content: "Przed pierwszą wizytą nie musisz wykonywać żadnych specjalnych przygotowań. Najważniejsze, żeby przekazać nam informacje o swoim samopoczuciu i ewentualnych dolegliwościach.",
    image: faqImage1,
  },

  {
    id: "czy-moge-wybrac-intensywnosc-masazu",
    categoryId: "wybor-masazu",
    title: "Czy mogę wybrać intensywność masażu?",
    content: "Tak. Intensywność zawsze dopasowujemy do Twojego komfortu, celu masażu i aktualnego stanu organizmu.",
    image: faqImage1,
  },
  {
    id: "jak-wybrac-masaz",
    categoryId: "wybor-masazu",
    popular: true,
    title: "Jak wybrać masaż?",
    content: "Zacznij od potrzeb, które są dla Ciebie najważniejsze. Na stronie usług możesz porównać strefy i opisy masaży, a jeśli nadal masz wątpliwości, skontaktuj się z nami przed rezerwacją.",
    image: faqImage1,
  },
  {
    id: "jak-umowic-masaz",
    categoryId: "rezerwacja-i-terminy",
    popular: true,
    title: "Jak umówić masaż?",
    content: "Przejdź do strony rezerwacji albo skontaktuj się z nami telefonicznie. Wybierz usługę i dogodny termin, a następnie postępuj zgodnie z informacjami widocznymi podczas rezerwacji.",
    image: faqImage1,
  },
  {
    id: "gdzie-odbywa-sie-wizyta",
    categoryId: "miejsce-wizyty",
    title: "Gdzie odbywa się wizyta?",
    content: "Masaże odbywają się w gabinecie ORHEA przy ul. Stysia we Wrocławiu. Jeśli potrzebujesz dokładnych wskazówek dojazdu, skontaktuj się z nami przed wizytą.",
    image: faqImage1,
  },
  {
    id: "jak-potwierdzic-forme-platnosci",
    categoryId: "platnosci",
    title: "Jak potwierdzić dostępną formę płatności?",
    content: "Aktualne informacje o dostępnych formach płatności potwierdzisz bezpośrednio z ORHEA przed wizytą. Dane kontaktowe znajdziesz na dole strony.",
    image: faqImage1,
  },
  {
    id: "jak-kupic-voucher",
    categoryId: "vouchery",
    popular: true,
    title: "Jak kupić voucher?",
    content: "Przejdź do strony voucherów ORHEA, aby zapoznać się z dostępnymi możliwościami zakupu. W razie pytań możesz również skontaktować się z nami bezpośrednio.",
    image: faqImage1,
  },
  {
    id: "czy-moge-zmienic-termin-wizyty",
    categoryId: "zmiana-i-anulowanie",
    title: "Czy mogę zmienić termin wizyty?",
    content: "Jeśli potrzebujesz zmienić termin, skontaktuj się z nami możliwie jak najwcześniej. Potwierdzimy, jakie inne terminy są aktualnie dostępne.",
    image: faqImage1,
  },
  {
    id: "czy-stan-zdrowia-wplywa-na-masaz",
    categoryId: "przed-masazem",
    title: "Czy stan zdrowia wpływa na możliwość wykonania masażu?",
    content: "Tak. Przed masażem poinformuj specjalistę o aktualnych dolegliwościach, chorobach, urazach i przyjmowanych lekach. W razie wątpliwości dotyczących bezpieczeństwa skonsultuj możliwość masażu z lekarzem.",
    image: faqImage1,
  },
  {
    id: "czy-trzeba-zglosic-alergie",
    categoryId: "przed-masazem",
    title: "Czy trzeba zgłosić alergie i nadwrażliwości?",
    content: "Tak. Przed rozpoczęciem masażu poinformuj specjalistę o alergiach, nadwrażliwościach skórnych i reakcjach na kosmetyki lub zapachy. Pozwala to odpowiednio dobrać stosowane preparaty.",
    image: faqImage1,
  },
];

export const homeFaqItems = faqItems.slice(0, 4);

export const popularFaqItems = faqItems.filter((item) => item.popular);

export const isFaqCategoryId = (value: string | null): value is FaqCategoryId => {
  return faqCategories.some((category) => category.id === value);
};
