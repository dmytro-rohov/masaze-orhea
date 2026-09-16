import type { APIContext } from "astro";
import { validateContactForm } from "@/lib/contact/validateContactForm";
import { sendContactMessage } from "@/lib/contact/sendContactMessage";
import { createContactResponse } from "@/lib/contact/createContactResponse";
import { createServiceInquiry } from "@/server/inquiries/service-inquiry.service";
import { attemptServiceInquiryCustomerNotification } from "@/server/inquiries/service-inquiry-notification.service";

export const prerender = false;
    
export async function POST({ request }: APIContext) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
      return createContactResponse(
        {
          success: false,
          message: "Nieprawidłowy format formularza.",
        },
        400
      );
    }

    const formData = await request.formData();

    const validation = validateContactForm(formData);

    if (!validation.success) {
      return createContactResponse(
        {
          success: false,
          message: "Popraw zaznaczone pola.",
          errors: validation.errors,
        },
        400
      );
    }

    if (validation.data.inquiryType) {
      const inquiry = await createServiceInquiry(validation.data);
      let teamNotificationSent = true;

      try {
        await sendContactMessage(validation.data);
      } catch (error) {
        teamNotificationSent = false;
        console.error("Service inquiry team notification failed:", {
          inquiryId: inquiry.id,
          error,
        });
      }

      const customerNotificationSent =
        await attemptServiceInquiryCustomerNotification({
          inquiryId: inquiry.id,
          event: "created",
        });

      return createContactResponse({
        success: true,
        message:
          teamNotificationSent && customerNotificationSent
            ? "Dziękujemy. Twoje zgłoszenie zostało przyjęte."
            : "Zgłoszenie zostało zapisane. Zespół ORHEA skontaktuje się z Tobą.",
      });
    }

    await sendContactMessage(validation.data);

    return createContactResponse({
      success: true,
      message: "Dziękujemy. Twoja wiadomość została wysłana.",
    });
  } catch (error) {
    console.error("Contact form error:", error);

    return createContactResponse(
      {
        success: false,
        message: "Nie udało się wysłać wiadomości. Spróbuj ponownie później.",
      },
      500
    );
  }
}

export async function GET() {
  return createContactResponse(
    {
      success: false,
      message: "Ta metoda nie jest obsługiwana.",
    },
    405
  );
}
