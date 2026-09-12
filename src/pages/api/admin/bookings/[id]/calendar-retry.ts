import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { retryAdminBookingCalendarSync } from "@/server/admin/admin-booking-calendar-retry.service";

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

  try {
    const result = await retryAdminBookingCalendarSync(
      locals.admin,
      params.id ?? "",
    );

    if (!result.success) {
      switch (result.reason) {
        case "not_found":
          return jsonResponse(
            { success: false, message: "Nie znaleziono rezerwacji." },
            404,
          );
        case "invalid_state":
          return jsonResponse(
            {
              success: false,
              message:
                "Synchronizację można ponowić tylko po wcześniejszym błędzie.",
            },
            409,
          );
        case "calendar_failure":
          return jsonResponse(
            {
              success: false,
              message:
                "Ponowna synchronizacja kalendarza nie powiodła się. Spróbuj ponownie później.",
            },
            502,
          );
      }
    }

    return jsonResponse(
      {
        success: true,
        bookingId: result.bookingId,
        googleCalendarEventId: result.googleCalendarEventId,
      },
      200,
    );
  } catch (error) {
    console.error("Admin booking calendar retry failed:", {
      bookingId: params.id,
      error,
    });

    return jsonResponse(
      {
        success: false,
        message: "Nie udało się ponowić synchronizacji kalendarza.",
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
