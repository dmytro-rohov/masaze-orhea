import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";

import {
  deleteAdminScheduleOverride,
  saveAdminScheduleOverride,
} from "@/server/admin/admin-schedule-overrides.service";

import type { BookingSpecialistId } from "@/server/bookings/booking.types";

export const prerender = false;

type AdminScheduleOverrideType = "unavailable" | "custom";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const isBookingSpecialistId = (value: unknown): value is BookingSpecialistId =>
  value === "adrian" || value === "aleksandra";

const isScheduleOverrideType = (
  value: unknown,
): value is AdminScheduleOverrideType =>
  value === "unavailable" || value === "custom";

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

  const action = formData.get("action");

  try {
    if (action === "delete") {
      const overrideId = formData.get("overrideId");

      if (typeof overrideId !== "string" || !overrideId) {
        return jsonResponse(
          {
            success: false,
            message: "Nieprawidłowy wyjątek.",
          },
          400,
        );
      }

      const result = await deleteAdminScheduleOverride({
        session: locals.admin,

        overrideId,
      });

      return jsonResponse(
        {
          success: true,

          id: result.id,
        },
        200,
      );
    }

    if (action !== "save") {
      return jsonResponse(
        {
          success: false,
          message: "Nieprawidłowa akcja.",
        },
        400,
      );
    }

    const specialistId = formData.get("specialistId");

    const overrideIdValue = formData.get("overrideId");

    const date = formData.get("date");

    const type = formData.get("type");

    const startTime = formData.get("startTime");

    const endTime = formData.get("endTime");

    if (!isBookingSpecialistId(specialistId)) {
      return jsonResponse(
        {
          success: false,
          message: "Nieprawidłowy specjalista.",
        },
        400,
      );
    }

    if (typeof date !== "string" || !date) {
      return jsonResponse(
        {
          success: false,
          message: "Wybierz prawidłową datę.",
        },
        400,
      );
    }

    if (!isScheduleOverrideType(type)) {
      return jsonResponse(
        {
          success: false,
          message: "Wybierz prawidłowy rodzaj wyjątku.",
        },
        400,
      );
    }

    const result = await saveAdminScheduleOverride({
      session: locals.admin,

      specialistId,

      overrideId:
        typeof overrideIdValue === "string" && overrideIdValue
          ? overrideIdValue
          : undefined,

      date,

      type,

      startTime: typeof startTime === "string" ? startTime : undefined,

      endTime: typeof endTime === "string" ? endTime : undefined,
    });

    return jsonResponse(
      {
        success: true,

        override: {
          id: result.id,

          date: result.date,

          isAvailable: result.isAvailable,

          startTime: result.startTime,

          endTime: result.endTime,
        },

      },
      200,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "ADMIN_SPECIALIST_SCOPE_FORBIDDEN") {
      return jsonResponse(
        {
          success: false,
          message: "Nie masz uprawnień do zmiany tego wyjątku.",
        },
        403,
      );
    }

    if (
      code === "ADMIN_SCHEDULE_OVERRIDE_INVALID_DATE" ||
      code === "ADMIN_SCHEDULE_OVERRIDE_INVALID_ID"
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Nieprawidłowa data lub identyfikator wyjątku.",
        },
        400,
      );
    }

    if (
      code === "ADMIN_SCHEDULE_OVERRIDE_INVALID_TIME" ||
      code === "ADMIN_SCHEDULE_OVERRIDE_INVALID_TIME_RANGE"
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Sprawdź godziny. Początek musi być wcześniejszy niż koniec.",
        },
        400,
      );
    }

    if (code === "ADMIN_SCHEDULE_OVERRIDE_NOT_FOUND") {
      return jsonResponse(
        {
          success: false,
          message: "Nie znaleziono wyjątku.",
        },
        404,
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

    console.error("Admin schedule override mutation failed:", {
      action,
      error,
    });

    return jsonResponse(
      {
        success: false,
        message: "Nie udało się zapisać zmian w grafiku.",
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
