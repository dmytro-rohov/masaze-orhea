import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/db";
import { serviceInquiries } from "@/db/schema";

export type ServiceInquiryNotificationEvent =
  | "created"
  | "confirmed"
  | "cancelled"
  | "rejected";

const typeLabels = {
  event_organization: "Organizacja eventów",
  client_travel: "Dojazd do klienta",
} as const;

const subjects: Record<ServiceInquiryNotificationEvent, string> = {
  created: "Przyjęliśmy Twoje zapytanie ORHEA",
  confirmed: "Twoje zapytanie ORHEA zostało potwierdzone",
  cancelled: "Twoje zapytanie ORHEA zostało anulowane",
  rejected: "Informacja o zapytaniu ORHEA",
};

const messages: Record<ServiceInquiryNotificationEvent, string> = {
  created:
    "Dziękujemy. Przyjęliśmy Twoje zapytanie i skontaktujemy się z Tobą, aby ustalić szczegóły.",
  confirmed:
    "Potwierdziliśmy możliwość realizacji zgłoszenia. Skontaktujemy się z Tobą w sprawie dalszych szczegółów.",
  cancelled: "Zgłoszenie zostało anulowane.",
  rejected:
    "Niestety nie możemy przyjąć tego zgłoszenia. W razie pytań zapraszamy do kontaktu.",
};

const desiredDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeZone: "Europe/Warsaw",
});

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const sendServiceInquiryCustomerNotification = async ({
  inquiryId,
  event,
}: {
  inquiryId: string;
  event: ServiceInquiryNotificationEvent;
}): Promise<void> => {
  const [inquiry] = await db
    .select({
      customerName: serviceInquiries.customerName,
      customerEmail: serviceInquiries.customerEmail,
      type: serviceInquiries.type,
      desiredDate: serviceInquiries.desiredDate,
      location: serviceInquiries.location,
    })
    .from(serviceInquiries)
    .where(eq(serviceInquiries.id, inquiryId))
    .limit(1);

  if (!inquiry) throw new Error("SERVICE_INQUIRY_NOT_FOUND");

  const details = [
    `Rodzaj zgłoszenia: ${typeLabels[inquiry.type]}`,
    `Pożądany termin: ${desiredDateFormatter.format(new Date(`${inquiry.desiredDate}T12:00:00Z`))}`,
    `Miejsce: ${inquiry.location}`,
  ];
  const text = [
    `Dzień dobry ${inquiry.customerName},`,
    "",
    messages[event],
    "",
    ...details,
    "",
    "Pozdrawiamy,",
    "ORHEA",
  ].join("\n");
  const html = `
    <p>Dzień dobry ${escapeHtml(inquiry.customerName)},</p>
    <p>${escapeHtml(messages[event])}</p>
    <ul>${details.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    <p>Pozdrawiamy,<br />ORHEA</p>
  `;
  const deliveryMode =
    import.meta.env?.BOOKING_EMAIL_DELIVERY_MODE ??
    process.env.BOOKING_EMAIL_DELIVERY_MODE;

  if (deliveryMode === "console") {
    console.info("Service inquiry customer notification:", {
      inquiryId,
      event,
      to: inquiry.customerEmail,
      subject: subjects[event],
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

  if (!apiKey || !from) throw new Error("BOOKING_EMAIL_CONFIGURATION_MISSING");

  const { error } = await new Resend(apiKey).emails.send(
    {
      from,
      to: inquiry.customerEmail,
      subject: subjects[event],
      text,
      html,
    },
    { idempotencyKey: `service-inquiry:${inquiryId}:${event}` },
  );

  if (error) throw new Error("SERVICE_INQUIRY_NOTIFICATION_FAILED");
};

export const attemptServiceInquiryCustomerNotification = async (
  input: Parameters<typeof sendServiceInquiryCustomerNotification>[0],
): Promise<boolean> => {
  try {
    await sendServiceInquiryCustomerNotification(input);
    return true;
  } catch (error) {
    console.error("Service inquiry customer notification failed:", {
      inquiryId: input.inquiryId,
      event: input.event,
      error,
    });
    return false;
  }
};
