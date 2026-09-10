export type CreateVoucherCheckoutInput = {
  massageId: string;
  variantCode: string;

  buyer: {
    firstName: string;
    lastName: string;
    email: string;
  };

  recipient: {
    name: string;
  };

  message?: string;
};

type ValidationSuccess = {
  success: true;
  data: CreateVoucherCheckoutInput;
};

type ValidationError = {
  success: false;
  message: string;
};

type ValidationResult = ValidationSuccess | ValidationError;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const validateVoucherCheckoutInput = (
  value: unknown,
): ValidationResult => {
  if (!isRecord(value)) {
    return {
      success: false,
      message: "Nieprawidłowe dane formularza.",
    };
  }

  if (
    !isNonEmptyString(value.massageId) ||
    !isNonEmptyString(value.variantCode)
  ) {
    return {
      success: false,
      message: "Wybierz masaż i wariant vouchera.",
    };
  }

  if (!isRecord(value.buyer)) {
    return {
      success: false,
      message: "Uzupełnij dane kupującego.",
    };
  }

  if (
    !isNonEmptyString(value.buyer.firstName) ||
    !isNonEmptyString(value.buyer.lastName)
  ) {
    return {
      success: false,
      message: "Uzupełnij imię i nazwisko kupującego.",
    };
  }

  if (
    !isNonEmptyString(value.buyer.email) ||
    !isValidEmail(value.buyer.email)
  ) {
    return {
      success: false,
      message: "Podaj poprawny adres e-mail.",
    };
  }

  if (!isRecord(value.recipient) || !isNonEmptyString(value.recipient.name)) {
    return {
      success: false,
      message: "Podaj imię odbiorcy vouchera.",
    };
  }

  if (
    value.message !== undefined &&
    (typeof value.message !== "string" || value.message.length > 300)
  ) {
    return {
      success: false,
      message: "Życzenia mogą mieć maksymalnie 300 znaków.",
    };
  }

  return {
    success: true,
    data: {
      massageId: value.massageId.trim(),
      variantCode: value.variantCode.trim(),

      buyer: {
        firstName: value.buyer.firstName.trim(),
        lastName: value.buyer.lastName.trim(),
        email: value.buyer.email.trim().toLowerCase(),
      },

      recipient: {
        name: value.recipient.name.trim(),
      },

      message:
        typeof value.message === "string" && value.message.trim().length > 0
          ? value.message.trim()
          : undefined,
    },
  };
};
