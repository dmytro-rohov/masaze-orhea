import type {
  BookingLocationType,
  BookingPreferredContactTime,
  BookingSpecialistId,
} from "@/server/bookings/booking.types";
import { MAX_BOOKING_ADDONS } from "@/server/bookings/booking-addons.service";

export type AdminBookingCreateInput = {
  adminCreationKey: string;
  massageId: string;
  variantCode: string;
  addonIds: string[];
  specialistId: BookingSpecialistId;
  date: string;
  time: string;
  locationType: BookingLocationType;
  mobileAddress?: {
    street: string;
    buildingNumber: string;
    apartmentNumber?: string;
    postalCode: string;
    city: string;
  };
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  contactByEmail: boolean;
  contactByPhone: boolean;
  preferredContactTime?: BookingPreferredContactTime;
  notes?: string;
  overrideConflicts: boolean;
};

export type AdminBookingCreateValidationResult =
  | { success: true; data: AdminBookingCreateInput }
  | { success: false; message: string; field?: string };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const postalCodePattern = /^\d{2}-\d{3}$/;

const readString = (
  formData: FormData,
  name: string,
  maxLength: number,
): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
};

export const validateAdminBookingCreateForm = (
  formData: FormData,
): AdminBookingCreateValidationResult => {
  const adminCreationKey = readString(formData, "adminCreationKey", 36);
  const massageId = readString(formData, "massageId", 100);
  const variantCode = readString(formData, "variantCode", 100);
  const addonIds = formData.getAll("addonIds");
  const specialistId = readString(formData, "specialistId", 32);
  const date = readString(formData, "date", 10);
  const time = readString(formData, "time", 5);
  const locationType = readString(formData, "locationType", 16);
  const firstName = readString(formData, "customerFirstName", 100);
  const lastName = readString(formData, "customerLastName", 100);
  const email = readString(formData, "customerEmail", 254).toLowerCase();
  const phone = readString(formData, "customerPhone", 50);
  const preferredContactTime = readString(
    formData,
    "preferredContactTime",
    32,
  );
  const notes = readString(formData, "notes", 2_000);
  const contactByEmail = formData.get("contactByEmail") === "on";
  const contactByPhone = formData.get("contactByPhone") === "on";
  const overrideConflicts = formData.get("overrideConflicts") === "true";

  const required: Array<[string, string, string]> = [
    [adminCreationKey, "adminCreationKey", "Odśwież formularz i spróbuj ponownie."],
    [massageId, "massageId", "Wybierz masaż."],
    [variantCode, "variantCode", "Wybierz wariant masażu."],
    [specialistId, "specialistId", "Wybierz specjalistę."],
    [date, "date", "Podaj datę wizyty."],
    [time, "time", "Podaj godzinę wizyty."],
    [locationType, "locationType", "Wybierz miejsce wizyty."],
    [firstName, "customerFirstName", "Podaj imię klienta."],
    [lastName, "customerLastName", "Podaj nazwisko klienta."],
    [email, "customerEmail", "Podaj adres e-mail klienta."],
  ];

  const missing = required.find(([value]) => !value);
  if (missing) {
    return { success: false, field: missing[1], message: missing[2] };
  }

  if (!uuidPattern.test(adminCreationKey)) {
    return { success: false, field: "adminCreationKey", message: "Odśwież formularz i spróbuj ponownie." };
  }
  if (
    addonIds.length > MAX_BOOKING_ADDONS ||
    !addonIds.every((id): id is string =>
      typeof id === "string" && id.length > 0 && id.length <= 100
    ) ||
    new Set(addonIds).size !== addonIds.length
  ) {
    return { success: false, field: "addonIds", message: "Nieprawidłowy wybór dodatków." };
  }
  if (!datePattern.test(date) || !timePattern.test(time)) {
    return { success: false, field: !datePattern.test(date) ? "date" : "time", message: "Podaj prawidłową datę i godzinę." };
  }
  if (specialistId !== "adrian" && specialistId !== "aleksandra") {
    return { success: false, field: "specialistId", message: "Wybierz prawidłowego specjalistę." };
  }
  if (locationType !== "salon" && locationType !== "mobile") {
    return { success: false, field: "locationType", message: "Wybierz prawidłowe miejsce wizyty." };
  }
  if (!emailPattern.test(email)) {
    return { success: false, field: "customerEmail", message: "Podaj poprawny adres e-mail." };
  }
  if (!contactByEmail && !contactByPhone) {
    return { success: false, field: "contactByEmail", message: "Wybierz co najmniej jedną formę kontaktu." };
  }
  if (contactByPhone && !phone) {
    return { success: false, field: "customerPhone", message: "Podaj numer telefonu dla kontaktu telefonicznego." };
  }

  const allowedContactTimes = ["morning", "afternoon", "evening"] as const;
  if (
    preferredContactTime &&
    !allowedContactTimes.includes(
      preferredContactTime as (typeof allowedContactTimes)[number],
    )
  ) {
    return { success: false, field: "preferredContactTime", message: "Wybierz prawidłową porę kontaktu." };
  }

  let mobileAddress: AdminBookingCreateInput["mobileAddress"];
  if (locationType === "mobile") {
    const street = readString(formData, "mobileStreet", 150);
    const buildingNumber = readString(formData, "mobileBuildingNumber", 30);
    const apartmentNumber = readString(formData, "mobileApartmentNumber", 30);
    const postalCode = readString(formData, "mobilePostalCode", 6);
    const city = readString(formData, "mobileCity", 100);

    if (!street || !buildingNumber || !postalCode || !city) {
      return { success: false, field: "mobileStreet", message: "Uzupełnij wymagane pola adresu usługi mobilnej." };
    }
    if (!postalCodePattern.test(postalCode)) {
      return { success: false, field: "mobilePostalCode", message: "Podaj kod pocztowy w formacie 00-000." };
    }

    mobileAddress = {
      street,
      buildingNumber,
      apartmentNumber: apartmentNumber || undefined,
      postalCode,
      city,
    };
  }

  return {
    success: true,
    data: {
      adminCreationKey,
      massageId,
      variantCode,
      addonIds,
      specialistId,
      date,
      time,
      locationType,
      mobileAddress,
      customer: { firstName, lastName, email, phone },
      contactByEmail,
      contactByPhone,
      preferredContactTime:
        (preferredContactTime as BookingPreferredContactTime) || undefined,
      notes: notes || undefined,
      overrideConflicts,
    },
  };
};
