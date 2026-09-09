import type {
  BookingLocationType,
  BookingPreferredContactTime,
  BookingSpecialistId,
  CreateBookingInput,
} from "./booking.types";

type ValidationResult =
  | {
      success: true;
      data: CreateBookingInput;
    }
  | {
      success: false;
      message: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isSpecialistId = (value: unknown): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

const isLocationType = (value: unknown): value is BookingLocationType =>
  value === "salon" || value === "mobile";

const isPreferredContactTime = (
  value: unknown,
): value is BookingPreferredContactTime =>
  value === "morning" || value === "afternoon" || value === "evening";

export const validateCreateBookingInput = (
  value: unknown,
): ValidationResult => {
  if (!isRecord(value)) {
    return {
      success: false,
      message: "Nieprawidłowe dane rezerwacji.",
    };
  }

  if (
    !isNonEmptyString(value.massageId) ||
    !isNonEmptyString(value.variantCode)
  ) {
    return {
      success: false,
      message: "Wybierz poprawny masaż i wariant.",
    };
  }

  if (!isSpecialistId(value.specialistId)) {
    return {
      success: false,
      message: "Wybierz poprawnego specjalistę.",
    };
  }

  if (!isNonEmptyString(value.startAt)) {
    return {
      success: false,
      message: "Wybierz termin wizyty.",
    };
  }

  if (!isLocationType(value.locationType)) {
    return {
      success: false,
      message: "Wybierz poprawne miejsce wizyty.",
    };
  }

  if (!isRecord(value.customer)) {
    return {
      success: false,
      message: "Uzupełnij dane kontaktowe.",
    };
  }

  if (
    !isNonEmptyString(value.customer.firstName) ||
    !isNonEmptyString(value.customer.lastName) ||
    !isNonEmptyString(value.customer.email)
  ) {
    return {
      success: false,
      message: "Uzupełnij wymagane dane klienta.",
    };
  }

  if (
    value.customer.phone !== undefined &&
    typeof value.customer.phone !== "string"
  ) {
    return {
      success: false,
      message: "Nieprawidłowy numer telefonu.",
    };
  }

  if (!isBoolean(value.contactByEmail) || !isBoolean(value.contactByPhone)) {
    return {
      success: false,
      message: "Nieprawidłowe ustawienia kontaktu.",
    };
  }

  if (
    value.preferredContactTime !== undefined &&
    !isPreferredContactTime(value.preferredContactTime)
  ) {
    return {
      success: false,
      message: "Nieprawidłowa preferowana pora kontaktu.",
    };
  }

  if (value.notes !== undefined && typeof value.notes !== "string") {
    return {
      success: false,
      message: "Nieprawidłowe uwagi.",
    };
  }

  if (!isBoolean(value.termsAccepted) || !isBoolean(value.privacyAccepted)) {
    return {
      success: false,
      message: "Nieprawidłowe dane zgód.",
    };
  }

  let mobileAddress: CreateBookingInput["mobileAddress"] | undefined;

  if (value.locationType === "mobile") {
    if (!isRecord(value.mobileAddress)) {
      return {
        success: false,
        message: "Dla wizyty mobilnej wymagany jest adres.",
      };
    }

    if (
      !isNonEmptyString(value.mobileAddress.street) ||
      !isNonEmptyString(value.mobileAddress.buildingNumber) ||
      !isNonEmptyString(value.mobileAddress.postalCode) ||
      !isNonEmptyString(value.mobileAddress.city)
    ) {
      return {
        success: false,
        message: "Uzupełnij wymagane dane adresowe.",
      };
    }

    if (
      value.mobileAddress.apartmentNumber !== undefined &&
      typeof value.mobileAddress.apartmentNumber !== "string"
    ) {
      return {
        success: false,
        message: "Nieprawidłowy numer mieszkania.",
      };
    }

    mobileAddress = {
      street: value.mobileAddress.street.trim(),
      buildingNumber: value.mobileAddress.buildingNumber.trim(),
      apartmentNumber: value.mobileAddress.apartmentNumber?.trim(),
      postalCode: value.mobileAddress.postalCode.trim(),
      city: value.mobileAddress.city.trim(),
    };
  }

  return {
    success: true,
    data: {
      massageId: value.massageId.trim(),
      variantCode: value.variantCode.trim(),
      specialistId: value.specialistId,
      startAt: value.startAt,
      locationType: value.locationType,

      mobileAddress,

      customer: {
        firstName: value.customer.firstName.trim(),
        lastName: value.customer.lastName.trim(),
        email: value.customer.email.trim(),
        phone: value.customer.phone?.trim() ?? "",
      },

      contactByEmail: value.contactByEmail,

      contactByPhone: value.contactByPhone,

      preferredContactTime: value.preferredContactTime,

      notes: typeof value.notes === "string" ? value.notes.trim() : undefined,

      termsAccepted: value.termsAccepted,

      privacyAccepted: value.privacyAccepted,
    },
  };
};
