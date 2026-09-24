export type BookingLocationType = "salon" | "mobile";

export type BookingPreferredContactTime = "morning" | "afternoon" | "evening";

export type BookingSpecialistId = "adrian" | "aleksandra";

export type BookingPaymentMethod = "online" | "on_site";

export type CreateBookingInput = {
  massageId: string;
  variantCode: string;
  addonIds: string[];
  paymentMethod: BookingPaymentMethod;
  publicCreationKey: string;
  specialistId: BookingSpecialistId;
  startAt: string;
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
  termsAccepted: boolean;
  privacyAccepted: boolean;
};
