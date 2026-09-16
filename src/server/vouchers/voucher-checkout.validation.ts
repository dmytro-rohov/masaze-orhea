export type CreateVoucherCheckoutInput = {
  massageId: string;
  variantCode: string;

  buyer: {
    firstName: string;
    lastName: string;
    email: string;
  };

  recipient: {
    name?: string;
  };

  deliveryType: "electronic" | "paper";

  shippingAddress?: {
    street: string;
    buildingNumber: string;
    apartmentNumber?: string;
    postalCode: string;
    city: string;
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

  if (!isRecord(value.recipient)) {
    return {
      success: false,
      message: "Nieprawidłowe dane odbiorcy vouchera.",
    };
  }

  if (
    value.recipient.name !== undefined &&
    (typeof value.recipient.name !== "string" || value.recipient.name.trim().length > 200)
  ) {
    return { success: false, message: "Dane odbiorcy są zbyt długie." };
  }

  if (value.deliveryType !== "electronic" && value.deliveryType !== "paper") {
    return { success: false, message: "Wybierz sposób dostarczenia vouchera." };
  }

  let shippingAddress: CreateVoucherCheckoutInput["shippingAddress"];

  if (value.deliveryType === "paper") {
    if (!isRecord(value.shippingAddress)) {
      return { success: false, message: "Uzupełnij adres wysyłki vouchera." };
    }

    const requiredShippingFields = [
      value.shippingAddress.street,
      value.shippingAddress.buildingNumber,
      value.shippingAddress.postalCode,
      value.shippingAddress.city,
    ];

    if (!requiredShippingFields.every(isNonEmptyString)) {
      return { success: false, message: "Uzupełnij adres wysyłki vouchera." };
    }

    if (!/^\d{2}-\d{3}$/.test(value.shippingAddress.postalCode as string)) {
      return { success: false, message: "Podaj kod pocztowy w formacie 00-000." };
    }

    shippingAddress = {
      street: (value.shippingAddress.street as string).trim(),
      buildingNumber: (value.shippingAddress.buildingNumber as string).trim(),
      apartmentNumber:
        typeof value.shippingAddress.apartmentNumber === "string" &&
        value.shippingAddress.apartmentNumber.trim()
          ? value.shippingAddress.apartmentNumber.trim()
          : undefined,
      postalCode: (value.shippingAddress.postalCode as string).trim(),
      city: (value.shippingAddress.city as string).trim(),
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
        name:
          typeof value.recipient.name === "string" && value.recipient.name.trim()
            ? value.recipient.name.trim()
            : undefined,
      },

      deliveryType: value.deliveryType,
      ...(shippingAddress ? { shippingAddress } : {}),

      message:
        typeof value.message === "string" && value.message.trim().length > 0
          ? value.message.trim()
          : undefined,
    },
  };
};
