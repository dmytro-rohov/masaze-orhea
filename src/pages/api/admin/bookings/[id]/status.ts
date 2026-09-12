import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import {
  isAdminBookingStatus,
  updateAdminBookingStatus,
} from "@/server/admin/admin-booking-status.service";

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

  const formData = await request.formData();
  const targetStatus = formData.get("status");

  if (typeof targetStatus !== "string" || !isAdminBookingStatus(targetStatus)) {
    return jsonResponse(
      { success: false, message: "Wybierz prawidłowy status rezerwacji." },
      400,
    );
  }

  try {
    const result = await updateAdminBookingStatus(
      locals.admin,
      params.id ?? "",
      targetStatus,
    );

    if (!result.success) {
      if (result.reason === "not_found") {
        return jsonResponse(
          { success: false, message: "Nie znaleziono rezerwacji." },
          404,
        );
      }

      if (result.reason === "invalid_transition") {
        return jsonResponse(
          {
            success: false,
            message: "Ta zmiana statusu nie jest już dozwolona.",
          },
          409,
        );
      }

      return jsonResponse(
        {
          success: false,
          message:
            "Nie udało się zaktualizować kalendarza. Status rezerwacji nie został zmieniony.",
        },
        502,
      );
    }

    return jsonResponse(
      {
        success: true,
        bookingId: result.bookingId,
        status: result.status,
        alreadyApplied: result.alreadyApplied,
      },
      200,
    );
  } catch (error) {
    console.error("Admin booking status mutation failed:", {
      bookingId: params.id,
      error,
    });

    return jsonResponse(
      {
        success: false,
        message: "Nie udało się zmienić statusu rezerwacji.",
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
