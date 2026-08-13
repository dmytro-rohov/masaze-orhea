import type { AccordionItem } from "@/components/widgets/Accordion.astro";

import faqImage1 from "@/assets/img/faq-image.png";


export const faqItems: AccordionItem[] = [
  {
    title: "Czy są przeciwwskazania?",
    content: "Tak. Przeciwwskazania zależą od rodzaju masażu i aktualnego stanu zdrowia. Jeśli masz wątpliwości, skontaktuj się z nami przed wizytą.",
    image: faqImage1,
    imageAlt: "test",
  },

  {
    title: "Czy masaż boli?",
    content: "Dobry masaż to nie tortura. Pracujemy na granicy Twojego komfortu. Zawsze mówisz, gdy nacisk jest za mocny. Komunikacja to podstawa.",
    image: faqImage1,
    open: true,
  },

  {
    title: "Jak odwołać wizytę?",
    content: "Jeśli potrzebujesz odwołać lub przełożyć wizytę, skontaktuj się z nami możliwie jak najwcześniej.",
    image: faqImage1,
  },

  {
    title: "Co ubrać na masaż?",
    content: "Przyjdź w wygodnym ubraniu. Przed zabiegiem wyjaśnimy, jak przygotować się do wybranego masażu.",
    image: faqImage1,
  },

  {
    title: "Jak przygotować się do pierwszej wizyty?",
    content: "Przed pierwszą wizytą nie musisz wykonywać żadnych specjalnych przygotowań. Najważniejsze, żeby przekazać nam informacje o swoim samopoczuciu i ewentualnych dolegliwościach.",
    image: faqImage1,
  },

  {
    title: "Czy mogę wybrać intensywność masażu?",
    content: "Tak. Intensywność zawsze dopasowujemy do Twojego komfortu, celu masażu i aktualnego stanu organizmu.",
    image: faqImage1,
  },
];

export const homeFaqItems = faqItems.slice(0, 4);