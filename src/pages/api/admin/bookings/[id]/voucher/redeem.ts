import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { redeemVoucherForCompletedBooking } from "@/server/admin/admin-voucher-actions.service";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function POST({ request, params, locals }: APIContext) {
  if (!locals.admin) {
    return json({ success: false, message: "Wymagane jest zalogowanie do panelu." }, 401);
  }
  if (!isSameOriginAdminRequest(request)) {
    return json({ success: false, message: "Nieprawidłowe źródło żądania." }, 403);
  }

  try {
    const result = await redeemVoucherForCompletedBooking(
      locals.admin,
      params.id ?? "",
    );
    if (!result.success) {
      return result.reason === "not_found"
        ? json({ success: false, message: "Nie znaleziono rezerwacji lub vouchera." }, 404)
        : json({ success: false, message: "Voucher można oznaczyć jako wykorzystany dopiero po zakończonej wizycie." }, 409);
    }

    return json(result, 200);
  } catch (error) {
    console.error("Booking voucher redeem failed:", { bookingId: params.id, error });
    return json({ success: false, message: "Nie udało się oznaczyć vouchera jako wykorzystanego." }, 500);
  }
}

export function GET() {
  return json({ success: false, message: "Ta metoda nie jest obsługiwana." }, 405);
}
