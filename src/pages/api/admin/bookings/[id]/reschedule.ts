import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { rescheduleAdminBooking } from "@/server/admin/admin-booking-reschedule.service";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const getValidationMessage = (errorCode?: string): string => {
  switch (errorCode) {
    case "BOOKING_MIN_NOTICE_NOT_MET":
      return "Nowy termin nie spełnia minimalnego czasu wyprzedzenia.";
    case "BOOKING_MAX_ADVANCE_EXCEEDED":
      return "Nowy termin przekracza maksymalny okres rezerwacji z wyprzedzeniem.";
    case "BOOKING_OUTSIDE_WORKING_HOURS":
      return "Nowy termin nie mieści się w godzinach pracy specjalisty.";
    default:
      return "Podaj prawidłową datę i godzinę wizyty.";
  }
};

export async function POST({ request, params, locals }: APIContext) {
  if (!locals.admin) {
    return jsonResponse(
      {
        success: false,
        message: "Wymagane jest zalogowanie do panelu administracyjnego.",
      },
      401,
    );
  }

  if (!isSameOriginAdminRequest(request)) {
    return jsonResponse(
      { success: false, message: "Nieprawidłowe źródło żądania." },
      403,
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return jsonResponse(
      { success: false, message: "Nieprawidłowy format danych." },
      400,
    );
  }

  const formData = await request.formData();
  const date = formData.get("date");
  const time = formData.get("time");

  if (typeof date !== "string" || typeof time !== "string") {
    return jsonResponse(
      { success: false, message: "Podaj nową datę i godzinę wizyty." },
      400,
    );
  }

  try {
    const result = await rescheduleAdminBooking(
      locals.admin,
      params.id ?? "",
      date,
      time,
    );

    if (!result.success) {
      switch (result.reason) {
        case "not_found":
          return jsonResponse(
            { success: false, message: "Nie znaleziono rezerwacji." },
            404,
          );
        case "invalid_input":
          return jsonResponse(
            {
              success: false,
              message: getValidationMessage(result.errorCode),
            },
            400,
          );
        case "invalid_status":
          return jsonResponse(
            {
              success: false,
              message:
                "Termin można zmienić tylko dla oczekującej lub potwierdzonej rezerwacji.",
            },
            409,
          );
        case "unavailable":
          return jsonResponse(
            {
              success: false,
              message: "Wybrany termin nie jest już dostępny.",
            },
            409,
          );
        case "concurrent_change":
          return jsonResponse(
            {
              success: false,
              message:
                "Rezerwacja została w międzyczasie zmieniona. Odśwież stronę i spróbuj ponownie.",
            },
            409,
          );
        case "configuration_failure":
          return jsonResponse(
            {
              success: false,
              message:
                "Nie można teraz zweryfikować dostępności specjalisty. Spróbuj ponownie później.",
            },
            503,
          );
        case "calendar_failure":
          return jsonResponse(
            {
              success: false,
              bookingUpdated: result.bookingUpdated,
              message:
                "Termin zapisano w ORHEA, ale nie udało się zaktualizować kalendarza. Odśwież stronę, aby zobaczyć aktualny stan synchronizacji.",
            },
            502,
          );
      }
    }

    return jsonResponse(
      {
        success: true,
        bookingId: result.bookingId,
        startAt: result.startAt.toISOString(),
        endAt: result.endAt.toISOString(),
      },
      200,
    );
  } catch (error) {
    console.error("Admin booking reschedule failed:", {
      bookingId: params.id,
      error,
    });

    return jsonResponse(
      {
        success: false,
        message: "Nie udało się zmienić terminu rezerwacji.",
      },
      500,
    );
  }
}

export function GET() {
  return jsonResponse(
    { success: false, message: "Ta metoda nie jest obsługiwana." },
    405,
  );
}
