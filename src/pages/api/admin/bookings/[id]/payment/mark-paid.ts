import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { markAdminBookingOnSitePaid } from "@/server/admin/admin-booking-on-site-payment.service";

export const prerender = false;

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function POST({ request, params, locals }: APIContext) {
  if (!locals.admin) return json({ success: false, message: "Wymagane jest zalogowanie do panelu." }, 401);
  if (!isOwner(locals.admin) || !isSameOriginAdminRequest(request)) {
    return json({ success: false, message: "Brak uprawnień do tej akcji." }, 403);
  }

  try {
    const result = await markAdminBookingOnSitePaid(locals.admin, params.id ?? "");
    if (!result.success) {
      return result.reason === "not_found"
        ? json({ success: false, message: "Nie znaleziono rezerwacji." }, 404)
        : json({ success: false, message: "Tej płatności nie można oznaczyć jako opłaconej." }, 409);
    }
    return json({
      success: true,
      paidAt: result.paidAt?.toISOString() ?? null,
      alreadyApplied: result.alreadyApplied,
      actorUsername: locals.admin.username,
    }, 200);
  } catch (error) {
    console.error("Admin on-site payment confirmation failed:", { bookingId: params.id, error });
    return json({ success: false, message: "Nie udało się zapisać płatności." }, 500);
  }
}

export function GET() {
  return json({ success: false, message: "Ta metoda nie jest obsługiwana." }, 405);
}
