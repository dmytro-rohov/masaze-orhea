import type { APIContext } from "astro";

import { isOwner } from "@/server/admin/admin-authorization.service";
import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { markPaperVoucherAsSent } from "@/server/admin/admin-voucher-actions.service";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST({ request, params, locals }: APIContext) {
  if (!locals.admin) {
    return jsonResponse(
      { success: false, message: "Wymagane jest zalogowanie." },
      401,
    );
  }

  if (!isOwner(locals.admin)) {
    return jsonResponse({ success: false, message: "Brak dostępu." }, 403);
  }

  if (!isSameOriginAdminRequest(request)) {
    return jsonResponse(
      { success: false, message: "Nieprawidłowe źródło żądania." },
      403,
    );
  }

  try {
    const result = await markPaperVoucherAsSent(
      locals.admin,
      params.id ?? "",
    );

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          message:
            result.reason === "not_found"
              ? "Nie znaleziono zamówienia."
              : "Tego zamówienia nie można oznaczyć jako wysłane.",
        },
        result.reason === "not_found" ? 404 : 409,
      );
    }

    return jsonResponse(result, 200);
  } catch (error) {
    console.error("Admin paper voucher delivery update failed:", {
      orderId: params.id,
      error,
    });
    return jsonResponse(
      { success: false, message: "Nie udało się zapisać statusu wysyłki." },
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
