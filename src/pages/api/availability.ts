import type { APIContext } from "astro";

import { generateBookingAvailability } from "../../server/bookings/booking-slot-generation.service";
import { isValidBookingDate } from "../../server/bookings/booking-time-zone";
import type { BookingSpecialistId } from "../../server/bookings/booking.types";

export const prerender = false;

const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const isBookingSpecialistId = (
  value: string | null,
): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

export async function GET({ request }: APIContext) {
  const searchParams = new URL(request.url).searchParams;
  const specialistId = searchParams.get("specialistId");
  const massageId = searchParams.get("massageId")?.trim();
  const variantCode = searchParams.get("variantCode")?.trim();
  const date = searchParams.get("date")?.trim();

  if (
    !isBookingSpecialistId(specialistId) ||
    !massageId ||
    !variantCode ||
    !date ||
    !isValidBookingDate(date)
  ) {
    return createJsonResponse(
      {
        success: false,
        message: "Podaj poprawne dane wyszukiwania dostępnych terminów.",
      },
      400,
    );
  }

  try {
    const availability = await generateBookingAvailability({
      specialistId,
      massageId,
      variantCode,
      date,
    });

    return createJsonResponse({
      success: true,
      ...availability,
    });
  } catch (error) {
    console.error("Booking availability API error:", error);

    if (error instanceof Error) {
      switch (error.message) {
        case "BOOKING_SPECIALIST_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany specjalista nie jest obecnie dostępny.",
            },
            400,
          );

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

        case "BOOKING_SETTINGS_NOT_FOUND":
        case "SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND":
        case "SPECIALIST_AVAILABILITY_CONFIGURATION_INVALID":
        case "SPECIALIST_CALENDAR_NOT_FOUND":
        case "BOOKING_TIME_ZONE_CONVERSION_FAILED":
        case "GOOGLE_CALENDAR_NOT_FOUND":
        case "GOOGLE_CALENDAR_QUERY_FAILED":
        case "GOOGLE_CALENDAR_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message: "Dostępne terminy są chwilowo niedostępne.",
            },
            503,
          );
      }
    }

    return createJsonResponse(
      {
        success: false,
        message: "Nie udało się pobrać dostępnych terminów.",
      },
      500,
    );
  }
}
