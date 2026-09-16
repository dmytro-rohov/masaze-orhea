import { db } from "@/db";
import { serviceInquiries } from "@/db/schema";
import type { ContactFormData, ServiceInquiryType } from "@/lib/contact/contact.types";

const databaseInquiryType: Record<
  ServiceInquiryType,
  "event_organization" | "client_travel"
> = {
  "event-organization": "event_organization",
  "client-travel": "client_travel",
};

export const createServiceInquiry = async (data: ContactFormData) => {
  if (!data.inquiryType || !data.desiredDate || !data.inquiryLocation) {
    throw new Error("SERVICE_INQUIRY_DATA_INVALID");
  }

  const [inquiry] = await db
    .insert(serviceInquiries)
    .values({
      type: databaseInquiryType[data.inquiryType],
      status: "pending",
      customerName: data.name,
      customerEmail: data.email,
      customerPhone: data.phone,
      desiredDate: data.desiredDate,
      location: data.inquiryLocation,
      notes: data.message || null,
      privacyAcceptedAt: new Date(),
    })
    .returning({ id: serviceInquiries.id });

  if (!inquiry) throw new Error("SERVICE_INQUIRY_CREATE_FAILED");

  return inquiry;
};
