import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { reassignAdminBooking } from "@/server/admin/admin-booking-reassignment.service";

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
      return "Podaj prawidłowego specjalistę, datę i godzinę wizyty.";
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

  if (locals.admin.role !== "owner") {
    return jsonResponse(
      { success: false, message: "Nie masz uprawnień do tej operacji." },
      403,
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
  const specialistId = formData.get("specialistId");
  const date = formData.get("date");
  const time = formData.get("time");

  if (
    typeof specialistId !== "string" ||
    typeof date !== "string" ||
    typeof time !== "string"
  ) {
    return jsonResponse(
      {
        success: false,
        message: "Wybierz specjalistę oraz podaj nową datę i godzinę.",
      },
      400,
    );
  }

  try {
    const result = await reassignAdminBooking(
      locals.admin,
      params.id ?? "",
      specialistId,
      date,
      time,
    );

    if (!result.success) {
      switch (result.reason) {
        case "forbidden":
          return jsonResponse(
            { success: false, message: "Nie masz uprawnień do tej operacji." },
            403,
          );
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
        case "invalid_target":
          return jsonResponse(
            {
              success: false,
              message: "Wybrany specjalista nie jest dostępny.",
            },
            400,
          );
        case "invalid_status":
          return jsonResponse(
            {
              success: false,
              message:
                "Termin i specjalistę można zmienić tylko dla oczekującej lub potwierdzonej rezerwacji.",
            },
            409,
          );
        case "not_future":
          return jsonResponse(
            {
              success: false,
              message: "Można zmieniać tylko przyszłą rezerwację.",
            },
            409,
          );
        case "unavailable":
          return jsonResponse(
            {
              success: false,
              message:
                "Wybrany specjalista nie jest dostępny w podanym terminie.",
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
              message:
                "Nie udało się zsynchronizować zmiany z kalendarzem. Sprawdź stan synchronizacji rezerwacji.",
            },
            502,
          );
      }
    }

    return jsonResponse(
      {
        success: true,
        bookingId: result.bookingId,
        specialistId: result.specialistId,
        startAt: result.startAt.toISOString(),
        endAt: result.endAt.toISOString(),
        alreadyApplied: result.alreadyApplied,
        notificationSent: result.notificationSent,
        warning:
          result.notificationSent === false
            ? "Zmiany zostały zapisane, ale nie udało się wysłać wiadomości do klienta."
            : undefined,
      },
      200,
    );
  } catch (error) {
    console.error("Admin booking schedule update failed:", {
      bookingId: params.id,
      error,
    });

    return jsonResponse(
      {
        success: false,
        message: "Nie udało się zmienić terminu i specjalisty.",
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
