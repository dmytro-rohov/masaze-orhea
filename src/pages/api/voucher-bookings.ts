import type { APIContext } from "astro";

import { validateVoucherBookingRequest } from "@/server/vouchers/voucher-booking.validation";
import {
  reserveVoucherForBookingCode,
  reserveVoucherForBookingToken,
} from "@/server/vouchers/voucher-reservation.service";

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function POST({ request }: APIContext) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return json({ success: false, message: "Nieprawidłowy format danych." }, 400);
  }
  try {
    const validation = validateVoucherBookingRequest(await request.json());
    if (!validation.success) return json({ success: false, message: validation.message }, 400);

    const booking = validation.data.token
      ? await reserveVoucherForBookingToken(
          validation.data.token,
          validation.data.reservation,
          new URL(request.url).origin,
        )
      : await reserveVoucherForBookingCode(
          validation.data.code!,
          validation.data.reservation,
          new URL(request.url).origin,
        );
    return json({
      success: true,
      message: booking.alreadyReserved
        ? "Ta rezerwacja została już zapisana."
        : "Rezerwacja z voucherem została przyjęta i oczekuje na potwierdzenie.",
      booking,
    }, booking.alreadyReserved ? 200 : 201);
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message;
      if (status === "BOOKING_SLOT_UNAVAILABLE") return json({ success: false, code: "slot_unavailable", message: "Wybrany termin nie jest już dostępny." }, 409);
      if (status === "VOUCHER_BOOKING_ALREADY_RESERVED") return json({ success: false, code: "voucher_reserved", message: "Voucher został już wykorzystany do rozpoczętej rezerwacji." }, 409);
      if (status === "VOUCHER_BOOKING_EXPIRED" || status === "VOUCHER_BOOKING_CANCELLED") return json({ success: false, code: "voucher_unavailable", message: "Voucher nie może już zostać wykorzystany." }, 410);
      if (status === "VOUCHER_BOOKING_NOT_FOUND") return json({ success: false, code: "voucher_unavailable", message: "Nie można rozpoznać vouchera." }, 404);
      if (status === "VOUCHER_BOOKING_UNAVAILABLE") return json({ success: false, code: "voucher_unavailable", message: "Voucher nie jest dostępny do rezerwacji." }, 409);
      if (status === "VOUCHER_TOP_UP_CHECKOUT_FAILED") return json({ success: false, code: "voucher_top_up_checkout_failed", message: "Nie udało się przygotować bezpiecznej płatności. Termin i voucher zostały zwolnione — wybierz je ponownie." }, 503);
      if (status === "VOUCHER_TOP_UP_PAYMENT_PROCESSING") return json({ success: false, code: "voucher_top_up_payment_processing", message: "Płatność jest już przetwarzana. Poczekaj chwilę na jej potwierdzenie." }, 409);
      if (status === "VOUCHER_EXTRA_ADDONS_INVALID_INPUT" || status === "VOUCHER_EXTRA_ADDONS_DUPLICATE" || status === "VOUCHER_EXTRA_ADDONS_UNAVAILABLE") return json({ success: false, message: "Wybrane dodatkowe dodatki nie są dostępne dla tej wizyty." }, 400);
      if (status === "VOUCHER_EXTRA_ADDONS_CONFLICT") return json({ success: false, message: "Wybranych dodatków nie można połączyć z voucherem lub ze sobą." }, 400);
      if (status === "BOOKING_MIN_NOTICE_NOT_MET" || status === "BOOKING_MAX_ADVANCE_EXCEEDED" || status === "BOOKING_OUTSIDE_WORKING_HOURS" || status === "BOOKING_SPECIALIST_UNAVAILABLE" || status === "VOUCHER_BOOKING_INVALID_START_TIME") return json({ success: false, message: "Wybrany termin nie jest dostępny dla tej rezerwacji." }, 400);
      if (status === "VOUCHER_BOOKING_INVALID_INPUT" || status === "VOUCHER_BOOKING_CONTACT_METHOD_REQUIRED" || status === "VOUCHER_BOOKING_CONSENT_REQUIRED" || status === "VOUCHER_BOOKING_MOBILE_ADDRESS_REQUIRED") return json({ success: false, message: "Sprawdź uzupełnione dane rezerwacji." }, 400);
      if (status === "BOOKING_SETTINGS_NOT_FOUND" || status === "SPECIALIST_AVAILABILITY_SETTINGS_NOT_FOUND" || status === "SPECIALIST_AVAILABILITY_CONFIGURATION_INVALID" || status === "SPECIALIST_AVAILABILITY_CALENDAR_NOT_FOUND" || status.startsWith("GOOGLE_CALENDAR_")) return json({ success: false, message: "Dostępność terminów jest chwilowo niedostępna." }, 503);
    }
    console.error("Voucher booking API error:", error);
    return json({ success: false, message: "Nie udało się utworzyć rezerwacji. Spróbuj ponownie później." }, 500);
  }
}

export async function GET() {
  return json({ success: false, message: "Ta metoda nie jest obsługiwana." }, 405);
}
