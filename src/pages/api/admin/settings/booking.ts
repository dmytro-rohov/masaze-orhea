import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";

import { isOwner } from "@/server/admin/admin-authorization.service";

import { updateAdminBookingSettings } from "@/server/admin/admin-settings.service";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,

    headers: {
      "Content-Type": "application/json",
    },
  });

const parseInteger = (value: FormDataEntryValue | null): number | null => {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : null;
};

export async function POST({ request, locals }: APIContext) {
  if (!locals.admin) {
    return jsonResponse(
      {
        success: false,

        message: "Wymagane jest zalogowanie do panelu administracyjnego.",
      },
      401,
    );
  }

  if (!isOwner(locals.admin)) {
    return jsonResponse(
      {
        success: false,

        message: "Ta operacja jest dostępna wyłącznie dla administratora.",
      },
      403,
    );
  }

  if (!isSameOriginAdminRequest(request)) {
    return jsonResponse(
      {
        success: false,

        message: "Nieprawidłowe źródło żądania.",
      },
      403,
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return jsonResponse(
      {
        success: false,

        message: "Nieprawidłowy format danych.",
      },
      400,
    );
  }

  const formData = await request.formData();

  const bufferMinutes = parseInteger(formData.get("bufferMinutes"));

  const slotStepMinutes = parseInteger(formData.get("slotStepMinutes"));

  if (bufferMinutes === null || slotStepMinutes === null) {
    return jsonResponse(
      {
        success: false,

        message: "Uzupełnij poprawnie ustawienia rezerwacji.",
      },
      400,
    );
  }

  try {
    const settings = await updateAdminBookingSettings({
      session: locals.admin,

      bufferMinutes,

      slotStepMinutes,
    });

    return jsonResponse(
      {
        success: true,

        settings,
      },
      200,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "ADMIN_BOOKING_BUFFER_INVALID") {
      return jsonResponse(
        {
          success: false,

          message: "Bufor musi być liczbą całkowitą od 0 do 240 minut.",
        },
        400,
      );
    }

    if (code === "ADMIN_BOOKING_SLOT_STEP_INVALID") {
      return jsonResponse(
        {
          success: false,

          message: "Krok slotów musi być liczbą całkowitą od 5 do 120 minut.",
        },
        400,
      );
    }

    if (code === "BOOKING_SETTINGS_NOT_FOUND") {
      return jsonResponse(
        {
          success: false,

          message: "Nie znaleziono globalnych ustawień rezerwacji.",
        },
        404,
      );
    }

    console.error("Admin booking settings update failed:", error);

    return jsonResponse(
      {
        success: false,

        message: "Nie udało się zapisać ustawień rezerwacji.",
      },
      500,
    );
  }
}

export function GET() {
  return jsonResponse(
    {
      success: false,

      message: "Ta metoda nie jest obsługiwana.",
    },
    405,
  );
}
