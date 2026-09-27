import type { VoucherReservationBookingInput } from "./voucher-reservation.service";

type VoucherCredential =
  | { token: string; code?: never }
  | { code: string; token?: never };

export type VoucherBookingRequest = VoucherCredential & {
  reservation: VoucherReservationBookingInput;
};

type ValidationResult =
  | { success: true; data: VoucherBookingRequest }
  | { success: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const string = (value: unknown, max = 500): string | null =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max
    ? value.trim()
    : null;

export const validateVoucherBookingRequest = (value: unknown): ValidationResult => {
  if (!isRecord(value)) return { success: false, message: "Nieprawidłowe dane rezerwacji." };

  const token = typeof value.voucherToken === "string" ? value.voucherToken.trim() : null;
  const code = typeof value.voucherCode === "string" ? value.voucherCode.trim() : null;
  if ((token ? 1 : 0) + (code ? 1 : 0) !== 1) {
    return { success: false, message: "Nie można rozpoznać vouchera." };
  }
  if (token && !/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    return { success: false, message: "Nie można rozpoznać vouchera." };
  }
  if (code && !/^ORHEA-[A-Z0-9-]{8,80}$/i.test(code)) {
    return { success: false, message: "Nie można rozpoznać vouchera." };
  }

  const publicCreationKey = typeof value.publicCreationKey === "string" ? value.publicCreationKey : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(publicCreationKey)) {
    return { success: false, message: "Odśwież formularz i spróbuj ponownie." };
  }
  if (value.specialistId !== "adrian" && value.specialistId !== "aleksandra") {
    return { success: false, message: "Wybierz poprawnego specjalistę." };
  }
  const startAt = string(value.startAt, 100);
  if (!startAt) return { success: false, message: "Wybierz termin wizyty." };
  if (value.locationType !== "salon" && value.locationType !== "mobile") {
    return { success: false, message: "Wybierz poprawne miejsce wizyty." };
  }
  if (!isRecord(value.customer)) return { success: false, message: "Uzupełnij dane kontaktowe." };
  const firstName = string(value.customer.firstName, 100);
  const lastName = string(value.customer.lastName, 100);
  const email = string(value.customer.email, 254);
  const phone = string(value.customer.phone, 20);
  if (!firstName || !lastName || !email || !phone) {
    return { success: false, message: "Uzupełnij wymagane dane klienta." };
  }
  if (typeof value.contactByEmail !== "boolean" || typeof value.contactByPhone !== "boolean") {
    return { success: false, message: "Nieprawidłowe ustawienia kontaktu." };
  }
  if (typeof value.termsAccepted !== "boolean" || typeof value.privacyAccepted !== "boolean") {
    return { success: false, message: "Nieprawidłowe dane zgód." };
  }

  let mobileAddress: VoucherReservationBookingInput["mobileAddress"];
  if (value.locationType === "mobile") {
    if (!isRecord(value.mobileAddress)) return { success: false, message: "Dla wizyty mobilnej wymagany jest adres." };
    const street = string(value.mobileAddress.street, 150);
    const buildingNumber = string(value.mobileAddress.buildingNumber, 20);
    const postalCode = string(value.mobileAddress.postalCode, 10);
    const city = string(value.mobileAddress.city, 100);
    const apartmentNumber = typeof value.mobileAddress.apartmentNumber === "string"
      ? value.mobileAddress.apartmentNumber.trim().slice(0, 20) || undefined
      : undefined;
    if (!street || !buildingNumber || !postalCode || !city) {
      return { success: false, message: "Uzupełnij wymagane dane adresowe." };
    }
    mobileAddress = { street, buildingNumber, apartmentNumber, postalCode, city };
  }

  const preferredContactTime = value.preferredContactTime;
  if (preferredContactTime !== undefined && preferredContactTime !== "morning" && preferredContactTime !== "afternoon" && preferredContactTime !== "evening") {
    return { success: false, message: "Nieprawidłowa preferowana pora kontaktu." };
  }
  if (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 500)) {
    return { success: false, message: "Nieprawidłowe uwagi." };
  }

  const reservation: VoucherReservationBookingInput = {
    publicCreationKey,
    specialistId: value.specialistId,
    startAt,
    locationType: value.locationType,
    mobileAddress,
    customer: { firstName, lastName, email, phone },
    contactByEmail: value.contactByEmail,
    contactByPhone: value.contactByPhone,
    preferredContactTime,
    notes: typeof value.notes === "string" ? value.notes.trim() || undefined : undefined,
    termsAccepted: value.termsAccepted,
    privacyAccepted: value.privacyAccepted,
  };
  return { success: true, data: token ? { token, reservation } : { code: code!, reservation } };
};
