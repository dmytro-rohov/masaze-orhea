import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";

import {
  parseAdminWeeklyScheduleRules,
  updateAdminWeeklySchedule,
} from "@/server/admin/admin-schedule-weekly.service";

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

  const rulesValue = formData.get("rules");

  if (!isBookingSpecialistId(specialistId)) {
    return jsonResponse(
      {
        success: false,
        message: "Nieprawidłowy specjalista.",
      },
      400,
    );
  }

  try {
    const rules = parseAdminWeeklyScheduleRules(rulesValue);

    const result = await updateAdminWeeklySchedule({
      session: locals.admin,

      specialistId,

      rules,
    });

    return jsonResponse(
      {
        success: true,
        specialistId: result.specialistId,
        rules: result.rules,
      },
      200,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "ADMIN_SPECIALIST_SCOPE_FORBIDDEN") {
      return jsonResponse(
        {
          success: false,
          message: "Nie masz uprawnień do edycji grafiku tego specjalisty.",
        },
        403,
      );
    }

    if (
      code === "ADMIN_WEEKLY_SCHEDULE_INVALID" ||
      code === "ADMIN_WEEKLY_SCHEDULE_INVALID_TIME_RANGE"
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Sprawdź godziny pracy. Początek musi być wcześniejszy niż koniec.",
        },
        400,
      );
    }

    if (code === "ADMIN_WEEKLY_SCHEDULE_OVERLAP") {
      return jsonResponse(
        {
          success: false,
          message:
            "Przedziały godzin tego samego dnia nie mogą na siebie nachodzić.",
        },
        400,
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

    console.error("Admin weekly schedule update failed:", {
      specialistId,
      error,
    });

    return jsonResponse(
      {
        success: false,
        message: "Nie udało się zapisać stałych godzin pracy.",
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
