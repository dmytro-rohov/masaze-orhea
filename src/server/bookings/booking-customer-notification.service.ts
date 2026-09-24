import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/db";
import { bookingAddons, bookings, specialists } from "@/db/schema";

export type BookingCustomerNotificationEvent =
  | "confirmed"
  | "cancelled"
  | "completed"
  | "rejected"
  | "rescheduled"
  | "booking_updated"
  | "specialist_reassigned"
  | "payment_received";

type SendBookingCustomerNotificationInput = {
  bookingId: string;
  event: BookingCustomerNotificationEvent;
  idempotencyKey: string;
  previousStartAt?: Date;
  previousEndAt?: Date;
};

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeZone: "Europe/Warsaw",
});
const timeFormatter = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});
const priceFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getMobileAddress = (booking: {
  locationType: "salon" | "mobile";
  mobileStreet: string | null;
  mobileBuildingNumber: string | null;
  mobileApartmentNumber: string | null;
  mobilePostalCode: string | null;
  mobileCity: string | null;
}): string | null => {
  if (
    booking.locationType !== "mobile" ||
    !booking.mobileStreet ||
    !booking.mobileBuildingNumber ||
    !booking.mobilePostalCode ||
    !booking.mobileCity
  ) {
    return null;
  }

  const apartment = booking.mobileApartmentNumber
    ? `/${booking.mobileApartmentNumber}`
    : "";

  return `${booking.mobileStreet} ${booking.mobileBuildingNumber}${apartment}, ${booking.mobilePostalCode} ${booking.mobileCity}`;
};

const getSubject = (event: BookingCustomerNotificationEvent): string => {
  switch (event) {
    case "confirmed":
      return "Twoja rezerwacja ORHEA została potwierdzona";
    case "cancelled":
      return "Twoja rezerwacja ORHEA została anulowana";
    case "completed":
      return "Dziękujemy za wizytę w ORHEA";
    case "rejected":
      return "Informacja o rezerwacji ORHEA";
    case "rescheduled":
      return "Nowy termin Twojej rezerwacji ORHEA";
    case "booking_updated":
      return "Zmiana terminu i specjalisty rezerwacji ORHEA";
    case "specialist_reassigned":
      return "Zmiana specjalisty rezerwacji ORHEA";
    case "payment_received":
      return "Płatność za rezerwację ORHEA została przyjęta";
  }
};

const getIntro = (event: BookingCustomerNotificationEvent): string => {
  switch (event) {
    case "confirmed":
      return "Twoja wizyta została potwierdzona.";
    case "cancelled":
      return "Twoja wizyta została anulowana.";
    case "completed":
      return "Dziękujemy za wizytę i zaufanie. Mamy nadzieję, że masaż przyniósł Ci odprężenie i dobre samopoczucie.";
    case "rejected":
      return "Niestety nie możemy przyjąć zgłoszonej rezerwacji.";
    case "rescheduled":
      return "Termin Twojej wizyty został zmieniony.";
    case "booking_updated":
      return "Termin i specjalista Twojej wizyty zostały zmienione.";
    case "specialist_reassigned":
      return "Specjalista przypisany do Twojej wizyty został zmieniony.";
    case "payment_received":
      return "Płatność została przyjęta. Twoja rezerwacja oczekuje na potwierdzenie terminu przez ORHEA.";
  }
};

export const sendBookingCustomerNotification = async ({
  bookingId,
  event,
  idempotencyKey,
  previousStartAt,
  previousEndAt,
}: SendBookingCustomerNotificationInput): Promise<void> => {
  const [booking] = await db
    .select({
      customerFirstName: bookings.customerFirstName,
      customerLastName: bookings.customerLastName,
      customerEmail: bookings.customerEmail,
      massageName: bookings.massageNameSnapshot,
      basePriceGrosze: bookings.priceGroszeSnapshot,
      totalPriceGrosze: bookings.totalPriceGroszeSnapshot,
      paymentMethod: bookings.paymentMethod,
      durationMinutes: bookings.durationMinutesSnapshot,
      durationLabel: bookings.durationLabelSnapshot,
      requestedStartAt: bookings.requestedStartAt,
      requestedEndAt: bookings.requestedEndAt,
      confirmedStartAt: bookings.confirmedStartAt,
      confirmedEndAt: bookings.confirmedEndAt,
      specialistName: specialists.displayName,
      locationType: bookings.locationType,
      mobileStreet: bookings.mobileStreet,
      mobileBuildingNumber: bookings.mobileBuildingNumber,
      mobileApartmentNumber: bookings.mobileApartmentNumber,
      mobilePostalCode: bookings.mobilePostalCode,
      mobileCity: bookings.mobileCity,
    })
    .from(bookings)
    .innerJoin(specialists, eq(specialists.id, bookings.specialistId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new Error("BOOKING_NOTIFICATION_BOOKING_NOT_FOUND");
  }

  const selectedAddons = await db
    .select({
      name: bookingAddons.nameSnapshot,
      priceGrosze: bookingAddons.priceGroszeSnapshot,
    })
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, bookingId));

  const startAt = booking.confirmedStartAt ?? booking.requestedStartAt;
  const endAt = booking.confirmedEndAt ?? booking.requestedEndAt;
  const duration =
    booking.durationLabel ??
    (booking.durationMinutes ? `${booking.durationMinutes} min` : "—");
  const mobileAddress = getMobileAddress(booking);
  const location =
    booking.locationType === "mobile"
      ? `Usługa mobilna${mobileAddress ? ` — ${mobileAddress}` : ""}`
      : "Salon ORHEA";
  const details = [
    `Masaż: ${booking.massageName}`,
    `Wariant: ${duration}`,
    `Specjalista: ${booking.specialistName}`,
    `Data: ${dateFormatter.format(startAt)}`,
    `Godzina: ${timeFormatter.format(startAt)}–${timeFormatter.format(endAt)}`,
    `Miejsce: ${location}`,
    `Metoda płatności: ${booking.paymentMethod === "online" ? "online" : "na miejscu"}`,
    ...(selectedAddons.length > 0
      ? [
          `Cena masażu: ${priceFormatter.format(booking.basePriceGrosze / 100)}`,
          ...selectedAddons.map((addon) =>
            `Dodatek: ${addon.name} — ${priceFormatter.format(addon.priceGrosze / 100)}`,
          ),
          `Razem: ${priceFormatter.format(booking.totalPriceGrosze / 100)}`,
        ]
      : []),
  ];
  const previousDetails =
    (event === "rescheduled" || event === "booking_updated") &&
    previousStartAt &&
    previousEndAt
      ? [
          `Poprzedni termin: ${dateFormatter.format(previousStartAt)}, ${timeFormatter.format(previousStartAt)}–${timeFormatter.format(previousEndAt)}`,
        ]
      : [];
  const greeting = `Dzień dobry ${booking.customerFirstName} ${booking.customerLastName},`;
  const intro = getIntro(event);
  const text = [
    greeting,
    "",
    intro,
    ...previousDetails.map((line) => `\n${line}`),
    "",
    ...details,
    "",
    "Pozdrawiamy,",
    "ORHEA",
  ].join("\n");
  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(intro)}</p>
    ${previousDetails.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <ul>${details.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    <p>Pozdrawiamy,<br />ORHEA</p>
  `;
  const deliveryMode =
    import.meta.env?.BOOKING_EMAIL_DELIVERY_MODE ??
    process.env.BOOKING_EMAIL_DELIVERY_MODE;

  if (!deliveryMode) {
    throw new Error("BOOKING_EMAIL_CONFIGURATION_MISSING");
  }

  if (deliveryMode === "console") {
    console.info("Booking customer notification:", {
      bookingId,
      event,
      to: booking.customerEmail,
      subject: getSubject(event),
      text,
    });
    return;
  }

  if (deliveryMode !== "resend") {
    throw new Error("BOOKING_EMAIL_DELIVERY_MODE_INVALID");
  }

  const apiKey = import.meta.env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  const from =
    import.meta.env?.BOOKING_EMAIL_FROM ?? process.env.BOOKING_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("BOOKING_EMAIL_CONFIGURATION_MISSING");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send(
    {
      from,
      to: booking.customerEmail,
      subject: getSubject(event),
      html,
      text,
    },
    { idempotencyKey: `booking:${bookingId}:${event}:${idempotencyKey}` },
  );

  if (error) {
    console.error("Booking customer email delivery failed:", {
      bookingId,
      event,
      error,
    });
    throw new Error("BOOKING_CUSTOMER_NOTIFICATION_FAILED");
  }
};

export const attemptBookingCustomerNotification = async (
  input: SendBookingCustomerNotificationInput,
): Promise<boolean> => {
  try {
    await sendBookingCustomerNotification(input);
    return true;
  } catch (error) {
    console.error("Booking customer notification failed:", {
      bookingId: input.bookingId,
      event: input.event,
      error,
    });
    return false;
  }
};
