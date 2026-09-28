import type { APIContext } from "astro";

import {
  getAvailableAddonsForMassage,
  getCurrentVoucherExtraAddonsForMassage,
} from "@/server/bookings/booking-addons.service";
import {
  resolveVoucherBookingByCode,
  resolveVoucherBookingByToken,
} from "@/server/vouchers/voucher-reservation.service";

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function GET({ request }: APIContext) {
  const massageId = new URL(request.url).searchParams.get("massageId")?.trim();
  // Existing voucher-purchase selector: current addons for a selected massage.
  if (massageId) {
    if (massageId.length > 100) return json({ success: false, message: "Podaj poprawny masaż." }, 400);
    try {
      return json({ success: true, addons: await getAvailableAddonsForMassage(massageId, "voucher") });
    } catch (error) {
      if (error instanceof Error && error.message === "VOUCHER_ADDON_MASSAGE_NOT_FOUND") {
        return json({ success: false, message: "Masaż nie jest dostępny jako voucher." }, 404);
      }
      console.error("Voucher purchase addons API error:", error);
      return json({ success: false, message: "Nie udało się pobrać dodatków." }, 500);
    }
  }

  const token = request.headers.get("x-orhea-voucher-token")?.trim();
  const code = request.headers.get("x-orhea-voucher-code")?.trim();
  if ((token ? 1 : 0) + (code ? 1 : 0) !== 1) {
    return json({ success: false, message: "Nie można rozpoznać vouchera." }, 400);
  }
  try {
    const voucher = token
      ? await resolveVoucherBookingByToken(token)
      : await resolveVoucherBookingByCode(code!);
    if (voucher.state !== "active") {
      return json({ success: false, message: "Voucher został już użyty do rozpoczętej rezerwacji." }, 409);
    }
    const addons = await getCurrentVoucherExtraAddonsForMassage({
      massageId: voucher.massageId,
      includedAddonIds: voucher.addons.map((addon) => addon.id),
    });
    return json({ success: true, addons });
  } catch (error) {
    if (error instanceof Error && error.message === "VOUCHER_BOOKING_NOT_FOUND") {
      return json({ success: false, message: "Nie można rozpoznać vouchera." }, 404);
    }
    if (error instanceof Error && (error.message === "VOUCHER_BOOKING_EXPIRED" || error.message === "VOUCHER_BOOKING_CANCELLED")) {
      return json({ success: false, message: "Voucher nie może już zostać wykorzystany." }, 410);
    }
    console.error("Voucher extra addons API error:", error);
    return json({ success: false, message: "Nie udało się pobrać dodatków." }, 500);
  }
}
