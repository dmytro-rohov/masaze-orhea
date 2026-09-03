import type { ContactFormData } from "../contact.types";

export async function sendToConsole(data: ContactFormData) {
  console.log("New ORHEA contact form submission:");
  console.log({
    name: data.name,
    email: data.email,
    phone: data.phone || "(not provided)",
    preferredContactMethod: data.preferredContactMethod,
    preferredContactTime: data.preferredContactTime || "(not provided)",
    subject: data.subject,
    massageId: data.massageId || "(not provided)",
    message: data.message,
    privacyAccepted: data.privacyAccepted,
    submittedAt: new Date().toISOString(),
  });
}
