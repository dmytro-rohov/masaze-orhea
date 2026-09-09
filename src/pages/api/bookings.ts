import type { APIContext } from "astro";

import { createBooking } from "../../server/bookings/booking.service";
import { validateCreateBookingInput } from "../../server/bookings/booking.validation";
export const prerender = false;

const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

export async function POST({ request }: APIContext) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return createJsonResponse(
        {
          success: false,
          message: "Nieprawidłowy format danych.",
        },
        400,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return createJsonResponse(
        {
          success: false,
          message: "Nieprawidłowy JSON.",
        },
        400,
      );
    }

    const validation = validateCreateBookingInput(body);

    if (!validation.success) {
      return createJsonResponse(
        {
          success: false,
          message: validation.message,
        },
        400,
      );
    }

    const booking = await createBooking(validation.data);

    return createJsonResponse(
      {
        success: true,
        message: "Rezerwacja została przyjęta i oczekuje na potwierdzenie.",
        booking,
      },
      201,
    );
  } catch (error) {
    console.error("Booking API error:", error);

    if (error instanceof Error) {
      switch (error.message) {
        case "BOOKING_VARIANT_NOT_FOUND":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany wariant masażu nie istnieje.",
            },
            400,
          );

        case "BOOKING_VARIANT_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany masaż nie jest obecnie dostępny do rezerwacji.",
            },
            400,
          );

        case "BOOKING_SPECIALIST_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany specjalista nie jest obecnie dostępny.",
            },
            400,
          );

        case "BOOKING_INVALID_START_TIME":
          return createJsonResponse(
            {
              success: false,
              message: "Podany termin rezerwacji jest nieprawidłowy.",
            },
            400,
          );

        case "BOOKING_MIN_NOTICE_NOT_MET":
          return createJsonResponse(
            {
              success: false,
              message:
                "Wybrany termin nie spełnia minimalnego czasu wyprzedzenia rezerwacji.",
            },
            400,
          );

        case "BOOKING_MAX_ADVANCE_EXCEEDED":
          return createJsonResponse(
            {
              success: false,
              message:
                "Wybrany termin przekracza maksymalny okres rezerwacji z wyprzedzeniem.",
            },
            400,
          );

        case "BOOKING_OUTSIDE_WORKING_HOURS":
          return createJsonResponse(
            {
              success: false,
              message:
                "Wybrany termin nie mieści się w godzinach pracy specjalisty.",
            },
            400,
          );

        case "BOOKING_MOBILE_ADDRESS_REQUIRED":
          return createJsonResponse(
            {
              success: false,
              message: "Dla wizyty mobilnej wymagany jest adres.",
            },
            400,
          );

        case "BOOKING_CONTACT_METHOD_REQUIRED":
          return createJsonResponse(
            {
              success: false,
              message: "Wybierz co najmniej jeden sposób kontaktu.",
            },
            400,
          );

        case "BOOKING_CONSENT_REQUIRED":
          return createJsonResponse(
            {
              success: false,
              message:
                "Wymagana jest akceptacja regulaminu i polityki prywatności.",
            },
            400,
          );

        case "BOOKING_SLOT_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany termin nie jest już dostępny.",
            },
            409,
          );
        case "SPECIALIST_CALENDAR_NOT_FOUND":
        case "BOOKING_SETTINGS_NOT_FOUND":
        case "SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND":
        case "SPECIALIST_AVAILABILITY_CONFIGURATION_INVALID":
        case "BOOKING_TIME_ZONE_CONVERSION_FAILED":
        case "GOOGLE_CALENDAR_NOT_FOUND":
        case "GOOGLE_CALENDAR_QUERY_FAILED":
        case "GOOGLE_CALENDAR_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message:
                "Rezerwacja online dla wybranego specjalisty jest chwilowo niedostępna.",
            },
            503,
          );
      }
    }

    return createJsonResponse(
      {
        success: false,
        message: "Nie udało się utworzyć rezerwacji. Spróbuj ponownie później.",
      },
      500,
    );
  }
}

export async function GET() {
  return createJsonResponse(
    {
      success: false,
      message: "Ta metoda nie jest obsługiwana.",
    },
    405,
  );
}
