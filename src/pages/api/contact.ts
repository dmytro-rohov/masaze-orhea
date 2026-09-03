import type { APIContext } from "astro";
import { validateContactForm } from "@/lib/contact/validateContactForm";
import { sendContactMessage } from "@/lib/contact/sendContactMessage";
import { createContactResponse } from "@/lib/contact/createContactResponse";

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
