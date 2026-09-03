export type ContactHour = {
  days: string;
  hours: string;
};

export const contactDetails = {
  phone: "+48 123 456 789",
  phoneHref: "tel:+48123456789",
  email: "kontakt@masazwroclaw.pl",
  emailHref: "mailto:kontakt@masazwroclaw.pl",
  address: "ul. Stysia, Wrocław",
  directionsHref:
    "https://www.google.com/maps/search/?api=1&query=ul.%20Stysia%2C%20Wroc%C5%82aw",
  mapEmbedHref:
    "https://www.google.com/maps?q=ul.%20Stysia%2C%20Wroc%C5%82aw&output=embed",
  hours: [
    { days: "Poniedziałek – Piątek", hours: "09:00–20:00" },
    { days: "Sobota", hours: "09:00–16:00" },
    { days: "Niedziela", hours: "Nieczynne" },
  ] satisfies ContactHour[],
} as const;
