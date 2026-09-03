export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  context: string;
  rating: number;
  isPlaceholder: boolean;
};

export const testimonials: Testimonial[] = [
  {
    id: "testimonial-placeholder-1",
    quote:  "Aleksandra ma dar. Jej masaż relaksacyjny to nie tylko dotyk, to podróż w jakieś spokojniejsze miejsce. Wychodzę i czuję, że świat jest lżejszy.",
    author: "Klientka ORHEA",
    context: "Nauczycielka",
    rating: 2,
    isPlaceholder: true,
  },
  {
    id: "testimonial-placeholder-2",
    quote:
      "Przyszedłem z bólem pleców, który męczył mnie od miesięcy. Po trzech wizytach u Adriana w końcu mogę się swobodnie schylić. Czysta robota.",
    author: "Klient ORHEA",
    context: "Programista, zdalnie",
    rating: 5,
    isPlaceholder: true,
  },
  {
    id: "testimonial-placeholder-3",
    quote:
      "Miejsce na zweryfikowaną opinię klienta po wizycie w gabinecie ORHEA.",
    author: "Klientka ORHEA",
    context: "Motocyklista",
    rating: 5,
    isPlaceholder: true,
  },
  {
    id: "testimonial-placeholder-4",
    quote:
      "Przyszedłem z bólem pleców, który męczył mnie od miesięcy. Po trzech wizytach u Adriana w końcu mogę się swobodnie schylić. Czysta robota.",
    author: "Klient ORHEA",
    context: "Programista, zdalnie",
    rating: 4,
    isPlaceholder: true,
  },
];
