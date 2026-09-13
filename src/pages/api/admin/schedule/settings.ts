import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";

import { updateAdminScheduleSettings } from "@/server/admin/admin-schedule-settings.service";

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

  const minNoticeValue = formData.get("minNoticeMinutes");

  const maxAdvanceValue = formData.get("maxAdvanceDays");

  const maxBookingsValue = formData.get("maxBookingsPerDay");

  if (!isBookingSpecialistId(specialistId)) {
    return jsonResponse(
      {
        success: false,
        message: "Nieprawidłowy specjalista.",
      },
      400,
    );
  }

  const minNoticeMinutes = parseInteger(minNoticeValue);

  const maxAdvanceDays = parseInteger(maxAdvanceValue);

  const maxBookingsPerDay =
    typeof maxBookingsValue === "string" && maxBookingsValue.trim() === ""
      ? null
      : parseInteger(maxBookingsValue);

  if (minNoticeMinutes === null || maxAdvanceDays === null) {
    return jsonResponse(
      {
        success: false,
        message: "Uzupełnij poprawnie ustawienia dostępności.",
      },
      400,
    );
  }

  if (
    typeof maxBookingsValue === "string" &&
    maxBookingsValue.trim() !== "" &&
    maxBookingsPerDay === null
  ) {
    return jsonResponse(
      {
        success: false,
        message: "Limit wizyt musi być liczbą całkowitą lub pozostać pusty.",
      },
      400,
    );
  }

  try {
    const result = await updateAdminScheduleSettings({
      session: locals.admin,

      specialistId,

      minNoticeMinutes,

      maxAdvanceDays,

      maxBookingsPerDay,
    });

    return jsonResponse(
      {
        success: true,
        settings: result,
      },
      200,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "ADMIN_SPECIALIST_SCOPE_FORBIDDEN") {
      return jsonResponse(
        {
          success: false,
          message: "Nie masz uprawnień do zmiany ustawień tego specjalisty.",
        },
        403,
      );
    }

    if (code === "ADMIN_SCHEDULE_MIN_NOTICE_INVALID") {
      return jsonResponse(
        {
          success: false,
          message:
            "Minimalne wyprzedzenie musi mieścić się między 0 a 43200 minut.",
        },
        400,
      );
    }

    if (code === "ADMIN_SCHEDULE_MAX_ADVANCE_INVALID") {
      return jsonResponse(
        {
          success: false,
          message:
            "Maksymalne wyprzedzenie musi mieścić się między 1 a 365 dni.",
        },
        400,
      );
    }

    if (code === "ADMIN_SCHEDULE_MAX_BOOKINGS_INVALID") {
      return jsonResponse(
        {
          success: false,
          message:
            "Limit wizyt musi mieścić się między 1 a 100 lub pozostać pusty.",
        },
        400,
      );
    }

    if (
      code === "SPECIALIST_NOT_FOUND" ||
      code === "SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND"
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Nie znaleziono konfiguracji specjalisty.",
        },
        404,
      );
    }

    console.error("Admin schedule settings update failed:", {
      specialistId,
      error,
    });

    return jsonResponse(
      {
        success: false,
        message: "Nie udało się zapisać ustawień dostępności.",
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
