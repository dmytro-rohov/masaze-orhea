import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { reassignAdminBooking } from "@/server/admin/admin-booking-reassignment.service";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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

  if (typeof specialistId !== "string") {
    return jsonResponse(
      { success: false, message: "Wybierz docelowego specjalistę." },
      400,
    );
  }

  try {
    const result = await reassignAdminBooking(
      locals.admin,
      params.id ?? "",
      specialistId,
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
                "Specjalistę można zmienić tylko dla oczekującej lub potwierdzonej rezerwacji.",
            },
            409,
          );
        case "not_future":
          return jsonResponse(
            {
              success: false,
              message: "Można przenieść tylko przyszłą rezerwację.",
            },
            409,
          );
        case "unavailable":
          return jsonResponse(
            {
              success: false,
              message:
                "Docelowy specjalista nie jest dostępny w terminie tej rezerwacji.",
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
                "Nie udało się przenieść wydarzenia między kalendarzami. Specjalista rezerwacji nie został zmieniony.",
            },
            502,
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
      }
    }

    return jsonResponse(
      {
        success: true,
        bookingId: result.bookingId,
        specialistId: result.specialistId,
        alreadyApplied: result.alreadyApplied,
      },
      200,
    );
  } catch (error) {
    console.error("Admin booking reassignment failed:", {
      bookingId: params.id,
      error,
    });

    return jsonResponse(
      {
        success: false,
        message: "Nie udało się zmienić specjalisty rezerwacji.",
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
