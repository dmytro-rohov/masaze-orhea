import type { APIContext } from "astro";
import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { AdminBookingPaymentLinkError, sendAdminBookingPaymentLink } from "@/server/admin/admin-booking-payment-link.service";

export const prerender = false;

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function POST({ request, params, locals, site, url }: APIContext) {
  if (!locals.admin) return json({ success: false, message: "Wymagane jest zalogowanie do panelu." }, 401);
  if (!isOwner(locals.admin) || !isSameOriginAdminRequest(request)) {
    return json({ success: false, message: "Brak uprawnień do tej akcji." }, 403);
  }
  try {
    const link = await sendAdminBookingPaymentLink(locals.admin, params.id ?? "", (site ?? url).origin);
    return json({ success: true, ...link }, 200);
  } catch (error) {
    if (error instanceof AdminBookingPaymentLinkError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "INVALID_STATE" || error.code === "PAYMENT_PROCESSING" ? 409 : error.code === "FORBIDDEN" ? 403 : 502;
      const message = error.code === "EMAIL_FAILED" ? "Nie udało się wysłać e-maila. Link pozostaje dostępny w panelu."
        : error.code === "INVALID_STATE" ? "Dla tej rezerwacji nie można wysłać linku."
          : error.code === "PAYMENT_PROCESSING" ? "Płatność jest przetwarzana. Odśwież szczegóły rezerwacji."
            : error.code === "NOT_FOUND" ? "Nie znaleziono rezerwacji."
              : "Nie udało się przygotować linku płatniczego.";
      return json({ success: false, message }, status);
    }
    return json({ success: false, message: "Nie udało się wysłać linku." }, 500);
  }
}

export function GET() {
  return json({ success: false, message: "Ta metoda nie jest obsługiwana." }, 405);
}
