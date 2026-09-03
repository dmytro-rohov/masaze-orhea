import type {
  ContactFormData,
  ContactValidationError,
  ContactValidationResult,
} from "./contact.types";
import { massages } from "@/data/massages";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const contactMethods = ["email", "phone"] as const;
const contactTimes = ["morning", "afternoon", "evening"] as const;
const subjects = [
  "massage-choice",
  "specific-massage",
  "booking",
  "voucher",
  "payment",
  "before-massage",
  "other",
] as const;

const massageIds = new Set<string>(massages.map((massage) => massage.id));

function isOneOf<T extends string>(value: string, options: readonly T[]): value is T {
  return options.some((option) => option === value);
}

export function validateContactForm(formData: FormData): ContactValidationResult {
  const name = getStringValue(formData, "name");
  const email = getStringValue(formData, "email");
  const phone = getStringValue(formData, "phone");
  const preferredContactMethod = getStringValue(formData, "preferredContactMethod");
  const preferredContactTime = getStringValue(formData, "preferredContactTime");
  const subject = getStringValue(formData, "subject");
  const massageId = getStringValue(formData, "massageId");
  const message = getStringValue(formData, "message");
  const privacyAccepted = getStringValue(formData, "privacyAccepted");
  const website = getStringValue(formData, "website");

  const errors: ContactValidationError[] = [];

  if (website) {
    errors.push({
      field: "form",
      message: "Wiadomość została odrzucona.",
    });
  }

  if (!name) {
    errors.push({
      field: "name",
      message: "Podaj imię.",
    });
  }

  if (name && (name.length < 2 || name.length > 100)) {
    errors.push({
      field: "name",
      message: "Imię powinno mieć od 2 do 100 znaków.",
    });
  }

  if (!email) {
    errors.push({
      field: "email",
      message: "Podaj adres e-mail.",
    });
  }

  if (email && (email.length > 254 || !isValidEmail(email))) {
    errors.push({
      field: "email",
      message: "Podaj poprawny adres e-mail.",
    });
  }

  if (phone && (!/^[+\d][\d\s()-]{6,19}$/.test(phone) || phone.length > 20)) {
    errors.push({
      field: "phone",
      message: "Podaj poprawny numer telefonu.",
    });
  }

  if (!isOneOf(preferredContactMethod, contactMethods)) {
    errors.push({
      field: "preferredContactMethod",
      message: "Wybierz preferowany sposób kontaktu.",
    });
  }

  if (preferredContactMethod === "phone" && !phone) {
    errors.push({
      field: "phone",
      message: "Podaj numer telefonu, jeśli wybierasz kontakt telefoniczny.",
    });
  }

  if (preferredContactTime && !isOneOf(preferredContactTime, contactTimes)) {
    errors.push({
      field: "preferredContactTime",
      message: "Wybierz prawidłową porę kontaktu.",
    });
  }

  if (!isOneOf(subject, subjects)) {
    errors.push({
      field: "subject",
      message: "Wybierz temat wiadomości.",
    });
  }

  if (massageId && !massageIds.has(massageId)) {
    errors.push({
      field: "massageId",
      message: "Wybierz masaż z listy.",
    });
  }

  if (!message) {
    errors.push({
      field: "message",
      message: "Napisz wiadomość.",
    });
  }

  if (message && (message.length < 10 || message.length > 1000)) {
    errors.push({
      field: "message",
      message: "Wiadomość powinna mieć od 10 do 1000 znaków.",
    });
  }

  if (privacyAccepted !== "true") {
    errors.push({
      field: "privacyAccepted",
      message: "Zaakceptuj Politykę prywatności.",
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      name,
      email,
      phone,
      preferredContactMethod: preferredContactMethod as ContactFormData["preferredContactMethod"],
      preferredContactTime: preferredContactTime as ContactFormData["preferredContactTime"],
      subject: subject as ContactFormData["subject"],
      massageId: massageId as ContactFormData["massageId"],
      message,
      privacyAccepted: true,
      website,
    },
  };
}
