import type { MassageId } from "@/data/massages";

export type ContactFormData = {
  name: string;
  email: string;
  phone: string;
  preferredContactMethod: "email" | "phone";
  preferredContactTime: "morning" | "afternoon" | "evening" | "";
  subject:
    | "massage-choice"
    | "specific-massage"
    | "booking"
    | "voucher"
    | "payment"
    | "before-massage"
    | "other";
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
