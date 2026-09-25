import type { ContactFormData } from "../contact.types";
import { serviceInquiryLabels } from "../contact.types";

export function createContactEmailText(data: ContactFormData) {
  if (data.inquiryType) {
    return [
      `Nowe zapytanie ORHEA: ${serviceInquiryLabels[data.inquiryType]}`,
      "",
      `Imię i nazwisko: ${data.name}`,
      `E-mail: ${data.email}`,
      `Telefon: ${data.phone}`,
      `Pożądany termin: ${data.desiredDate}`,
      `Miejsce: ${data.inquiryLocation}`,
      "",
      "Uwagi do zamówienia:",
      data.message || "Brak uwag",
    ].join("\n");
  }

  const massageLabel = data.massageName ?? "Nie wybrano";

  return [
    "Nowa wiadomość z formularza ORHEA",
    "",
    `Imię: ${data.name}`,
    `E-mail: ${data.email}`,
    `Telefon: ${data.phone || "Nie podano"}`,
    `Preferowany kontakt: ${data.preferredContactMethods.join(", ")}`,
    `Pora kontaktu: ${data.preferredContactTime || "Nie podano"}`,
    `Temat: ${data.subject}`,
    `Masaż: ${massageLabel}`,
    "",
    "Wiadomość:",
    data.message,
  ].join("\n");
}
