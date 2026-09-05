import type { MassageId } from "@/data/massages";

export const contactSubjectOptions = [
  { value: "massage-choice", label: "Pomoc w wyborze masażu" },
  { value: "specific-massage", label: "Pytanie o konkretny masaż" },
  { value: "booking", label: "Rezerwacja / termin" },
  { value: "voucher", label: "Voucher" },
  { value: "payment", label: "Płatność" },
  { value: "before-massage", label: "Przed masażem" },
  { value: "mobile-services", label: "Usługi mobilne" },
  { value: "other", label: "Inne" },
] as const;

export type ContactSubject = (typeof contactSubjectOptions)[number]["value"];
export type ContactMethod = "email" | "phone";

export type ContactFormData = {
  name: string;
  email: string;
  phone: string;
  preferredContactMethods: ContactMethod[];
  preferredContactTime: "morning" | "afternoon" | "evening" | "";
  subject: ContactSubject;
  massageId: MassageId | "";
  message: string;
  privacyAccepted: true;
  website?: string;
};

export type ContactValidationError = {
  field: keyof ContactFormData | "form";
  message: string;
};

export type ContactValidationResult =
  | {
      success: true;
      data: ContactFormData;
    }
  | {
      success: false;
      errors: ContactValidationError[];
    };

export type ContactApiResponse =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
      errors?: ContactValidationError[];
    };
