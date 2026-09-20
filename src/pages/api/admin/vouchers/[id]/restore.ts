import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { restoreAdminVoucher } from "@/server/admin/admin-voucher-actions.service";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST({ request, params, locals }: APIContext) {
  if (!locals.admin) {
    return jsonResponse({ success: false, message: "Wymagane jest zalogowanie." }, 401);
  }

  if (!isOwner(locals.admin)) {
    return jsonResponse({ success: false, message: "Brak dostępu." }, 403);
  }

  if (!isSameOriginAdminRequest(request)) {
    return jsonResponse({ success: false, message: "Nieprawidłowe źródło żądania." }, 403);
  }

  try {
    const result = await restoreAdminVoucher(locals.admin, params.id ?? "");

    if (!result.success) {
      if (result.reason === "not_found") {
        return jsonResponse({ success: false, message: "Nie znaleziono vouchera." }, 404);
      }

      return jsonResponse(
        { success: false, message: "Tego vouchera nie można przywrócić do aktywnych." },
        409,
      );
    }

    return jsonResponse(result, 200);
  } catch (error) {
    console.error("Admin voucher restore failed:", { voucherId: params.id, error });
    return jsonResponse({ success: false, message: "Nie udało się przywrócić vouchera." }, 500);
  }
}
