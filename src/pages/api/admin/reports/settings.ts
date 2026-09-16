import type { APIContext } from "astro";

import { isOwner } from "@/server/admin/admin-authorization.service";
import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { updateStoredReportSettings } from "@/server/reports/report-settings.service";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const normalizeOptional = (value: FormDataEntryValue | null): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const isValidEmail = (value: string | null): boolean =>
  value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidFolderId = (value: string | null): boolean =>
  value === null || /^[A-Za-z0-9_-]{10,200}$/.test(value);

export async function POST({ request, locals }: APIContext) {
  if (!locals.admin) {
    return jsonResponse(
      { success: false, message: "Wymagane jest zalogowanie." },
      401,
    );
  }

  if (!isOwner(locals.admin)) {
    return jsonResponse(
      { success: false, message: "Nie masz uprawnień do tej konfiguracji." },
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

  const formData = await request.formData();
  const ownerEmail = normalizeOptional(formData.get("ownerEmail"));
  const folderId = normalizeOptional(formData.get("folderId"));
  const aleksandraEmail = normalizeOptional(formData.get("aleksandraEmail"));

  if (!isValidEmail(ownerEmail) || !isValidEmail(aleksandraEmail)) {
    return jsonResponse(
      { success: false, message: "Podaj poprawny adres e-mail." },
      400,
    );
  }

  if (!isValidFolderId(folderId)) {
    return jsonResponse(
      { success: false, message: "Podaj poprawny identyfikator folderu Google Drive." },
      400,
    );
  }

  try {
    await updateStoredReportSettings({
      ownerEmail,
      folderId,
      aleksandraEmail,
    });

    return jsonResponse(
      { success: true, message: "Ustawienia raportów zostały zapisane." },
      200,
    );
  } catch (error) {
    console.error("Admin report settings update failed:", error);

    return jsonResponse(
      { success: false, message: "Nie udało się zapisać ustawień raportów." },
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
