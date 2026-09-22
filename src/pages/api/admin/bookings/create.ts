import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { createAdminBooking } from "@/server/admin/admin-booking-create.service";
import { validateAdminBookingCreateForm } from "@/server/admin/admin-booking-create.validation";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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
      { success: false, message: "Ta funkcja jest dostępna tylko dla ownera." },
      403,
    );
  }
  if (!isSameOriginAdminRequest(request)) {
    return jsonResponse(
      { success: false, message: "Nieprawidłowe źródło żądania." },
      403,
    );
  }
  if (
    !(request.headers.get("content-type") ?? "").includes(
      "application/x-www-form-urlencoded",
    )
  ) {
    return jsonResponse(
      { success: false, message: "Nieprawidłowy format danych." },
      400,
    );
  }

  const validation = validateAdminBookingCreateForm(await request.formData());
  if (!validation.success) {
    return jsonResponse(
      {
        success: false,
        message: validation.message,
        field: validation.field,
      },
      400,
    );
  }

  try {
    const result = await createAdminBooking(locals.admin, validation.data);

    if (!result.success) {
      if (result.reason === "requires_override") {
        return jsonResponse(
          {
            success: false,
            requiresOverride: true,
            message:
              "Termin narusza standardowe reguły dostępności. Sprawdź ostrzeżenia przed zapisaniem rezerwacji.",
            conflicts: result.conflicts,
          },
          409,
        );
      }

      const responseByReason = {
        forbidden: [403, "Ta funkcja jest dostępna tylko dla ownera."],
        variant_not_found: [400, "Nie znaleziono wybranego wariantu masażu."],
        variant_unavailable: [409, "Wybrany wariant nie jest dostępny do rezerwacji."],
        specialist_unavailable: [409, "Wybrany specjalista nie jest aktywny."],
        invalid_start_time: [400, "Podaj prawidłową datę i godzinę wizyty."],
        configuration_failure: [503, "Nie można teraz sprawdzić dostępności. Zweryfikuj konfigurację specjalisty i spróbuj ponownie."],
        data_changed: [409, "Dane usługi lub specjalisty zmieniły się podczas zapisu. Odśwież formularz i spróbuj ponownie."],
      } as const;
      const [status, message] = responseByReason[result.reason];
      return jsonResponse(
        { success: false, message, errorCode: result.errorCode },
        status,
      );
    }

    const warnings: string[] = [];
    if (result.calendarSyncStatus === "failed") {
      warnings.push(
        "Rezerwacja została zapisana, ale synchronizacja kalendarza nie powiodła się. Możesz ponowić ją w szczegółach rezerwacji.",
      );
    }
    if (result.notificationSent === false) {
      warnings.push(
        "Rezerwacja została zapisana, ale nie udało się wysłać potwierdzenia do klienta.",
      );
    }

    return jsonResponse(
      {
        success: true,
        bookingId: result.bookingId,
        alreadyApplied: result.alreadyApplied,
        warning: warnings.join(" ") || undefined,
      },
      200,
    );
  } catch (error) {
    console.error("Admin manual booking creation failed:", error);
    return jsonResponse(
      {
        success: false,
        message: "Nie udało się utworzyć rezerwacji. Spróbuj ponownie.",
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
