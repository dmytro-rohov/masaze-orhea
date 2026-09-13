import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { resendAdminVoucherEmail } from "@/server/admin/admin-voucher-actions.service";

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

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return jsonResponse({ success: false, message: "Nieprawidłowy format danych." }, 400);
  }

  const formData = await request.formData();
  const deliveryVersion = formData.get("deliveryVersion");

  if (typeof deliveryVersion !== "string") {
    return jsonResponse({ success: false, message: "Odśwież stronę i spróbuj ponownie." }, 400);
  }

  const expectedAttemptedAt = deliveryVersion || null;
  if (
    expectedAttemptedAt !== null &&
    (!Number.isFinite(Date.parse(expectedAttemptedAt)) ||
      new Date(expectedAttemptedAt).toISOString() !== expectedAttemptedAt)
  ) {
    return jsonResponse({ success: false, message: "Odśwież stronę i spróbuj ponownie." }, 400);
  }

  try {
    const result = await resendAdminVoucherEmail(
      locals.admin,
      params.id ?? "",
      expectedAttemptedAt,
    );

    if (!result.success) {
      if (result.reason === "not_found") {
        return jsonResponse({ success: false, message: "Nie znaleziono vouchera." }, 404);
      }

      if (result.reason === "invalid_transition") {
        return jsonResponse({ success: false, message: "Dla tego vouchera wysyłka nie jest dostępna." }, 409);
      }

      return jsonResponse(
        { success: false, message: "Nie udało się wysłać wiadomości. Stan dostarczenia został zapisany." },
        502,
      );
    }

    return jsonResponse(result, 200);
  } catch (error) {
    console.error("Admin voucher resend endpoint failed:", { voucherId: params.id, error });
    return jsonResponse({ success: false, message: "Nie udało się ponowić wysyłki." }, 500);
  }
}

