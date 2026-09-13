import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";

import { isOwner } from "@/server/admin/admin-authorization.service";

import { updateAdminSpecialist } from "@/server/admin/admin-specialists.service";

import type { BookingSpecialistId } from "@/server/bookings/booking.types";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,

    headers: {
      "Content-Type": "application/json",
    },
  });

const isBookingSpecialistId = (value: unknown): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

const parseBoolean = (value: FormDataEntryValue | null): boolean =>
  value === "true" || value === "on" || value === "1";

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

  const specialistId = formData.get("specialistId");

  const displayName = formData.get("displayName");

  const googleCalendarId = formData.get("googleCalendarId");

  const calendarLabel = formData.get("calendarLabel");

  if (!isBookingSpecialistId(specialistId)) {
    return jsonResponse(
      {
        success: false,

        message: "Nieprawidłowy specjalista.",
      },
      400,
    );
  }

  if (
    typeof displayName !== "string" ||
    typeof googleCalendarId !== "string" ||
    typeof calendarLabel !== "string"
  ) {
    return jsonResponse(
      {
        success: false,

        message: "Nieprawidłowe dane formularza.",
      },
      400,
    );
  }

  const isActive = parseBoolean(formData.get("isActive"));

  const calendarIsActive = parseBoolean(formData.get("calendarIsActive"));

  try {
    const result = await updateAdminSpecialist({
      session: locals.admin,

      specialistId,

      displayName,

      isActive,

      googleCalendarId,

      calendarLabel,

      calendarIsActive,
    });

    return jsonResponse(
      {
        success: true,

        specialist: result,
      },
      200,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "ADMIN_SPECIALIST_DISPLAY_NAME_INVALID") {
      return jsonResponse(
        {
          success: false,

          message: "Nazwa specjalisty musi mieć od 2 do 80 znaków.",
        },
        400,
      );
    }

    if (code === "ADMIN_SPECIALIST_CALENDAR_ID_INVALID") {
      return jsonResponse(
        {
          success: false,

          message: "Google Calendar ID jest nieprawidłowy.",
        },
        400,
      );
    }

    if (code === "ADMIN_SPECIALIST_CALENDAR_LABEL_INVALID") {
      return jsonResponse(
        {
          success: false,

          message: "Etykieta kalendarza może mieć maksymalnie 100 znaków.",
        },
        400,
      );
    }

    if (code === "ADMIN_SPECIALIST_CALENDAR_ALREADY_ASSIGNED") {
      return jsonResponse(
        {
          success: false,

          message:
            "Ten Google Calendar jest już przypisany do innego specjalisty.",
        },
        409,
      );
    }

    if (code === "SPECIALIST_NOT_FOUND") {
      return jsonResponse(
        {
          success: false,

          message: "Nie znaleziono specjalisty.",
        },
        404,
      );
    }

    console.error("Admin specialist update failed:", {
      specialistId,
      error,
    });

    return jsonResponse(
      {
        success: false,

        message: "Nie udało się zapisać zmian specjalisty.",
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
