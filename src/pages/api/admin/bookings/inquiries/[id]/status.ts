import type { APIContext } from "astro";

import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import {
  adminServiceInquiryStatuses,
  updateAdminServiceInquiryStatus,
  type AdminServiceInquiryStatus,
} from "@/server/admin/admin-service-inquiries.service";

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

  const target = (await request.formData()).get("status");
  if (
    typeof target !== "string" ||
    !adminServiceInquiryStatuses.includes(target as AdminServiceInquiryStatus) ||
    target === "pending"
  ) {
    return jsonResponse(
      { success: false, message: "Wybierz prawidłowy status zgłoszenia." },
      400,
    );
  }

  try {
    const result = await updateAdminServiceInquiryStatus(
      params.id ?? "",
      target as AdminServiceInquiryStatus,
    );

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          message:
            result.reason === "not_found"
              ? "Nie znaleziono zgłoszenia."
              : "Ta zmiana statusu nie jest dozwolona.",
        },
        result.reason === "not_found" ? 404 : 409,
      );
    }

    const notificationSent =
      "notificationSent" in result ? result.notificationSent : undefined;

    return jsonResponse(
      {
        success: true,
        status: result.status,
        alreadyApplied: result.alreadyApplied,
        notificationSent,
        warning:
          notificationSent === false
            ? "Status został zmieniony, ale nie udało się wysłać wiadomości do klienta."
            : undefined,
      },
      200,
    );
  } catch (error) {
    console.error("Admin service inquiry status update failed:", error);
    return jsonResponse(
      { success: false, message: "Nie udało się zmienić statusu zgłoszenia." },
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
