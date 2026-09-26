import type { APIContext } from "astro";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { saveAdminMassage } from "@/server/admin/admin-massages.service";

export const prerender = false;
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST({ request, locals }: APIContext) {
  if (!locals.admin) return json({ success: false, message: "Wymagane jest zalogowanie." }, 401);
  if (!isOwner(locals.admin) || !isSameOriginAdminRequest(request)) return json({ success: false, message: "Brak dostępu." }, 403);
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json({ success: false, message: "Nieprawidłowy format danych." }, 400);
  try {
    const body = await request.text();
    if (body.length > 120_000) return json({ success: false, message: "Formularz jest zbyt duży." }, 413);
    const payload = JSON.parse(body) as { id?: unknown; draft?: unknown };
    if (!payload || typeof payload !== "object" || (payload.id !== undefined && (typeof payload.id !== "string" || !payload.id || payload.id.length > 100)))
      return json({ success: false, message: "Nieprawidłowe dane." }, 400);
    const result = await saveAdminMassage(locals.admin, payload.draft, payload.id as string | undefined);
    return json({ success: true, ...result }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code.startsWith("ADMIN_MASSAGE_")) {
      const messages: Record<string, string> = {
        ADMIN_MASSAGE_INVALID_INPUT: "Sprawdź pola formularza, warianty i treść strony.",
        ADMIN_MASSAGE_INVALID_SLUG: "Adres usługi może zawierać tylko małe litery, cyfry i myślniki.",
        ADMIN_MASSAGE_SLUG_TAKEN: "Ten adres usługi jest już zajęty.",
        ADMIN_MASSAGE_VIP_EXISTS: "Może istnieć tylko jeden aktywny masaż VIP.",
        ADMIN_MASSAGE_VIP_RESERVED: "Strefa VIP jest zarezerwowana dla istniejącego Rytuału VIP.",
        ADMIN_MASSAGE_VIP_STEPS_REQUIRED: "Aktywny Rytuał VIP wymaga etapów zabiegu.",
        ADMIN_MASSAGE_NO_ACTIVE_VARIANT: "Aktywna oferta booking/voucher wymaga aktywnego wariantu.",
        ADMIN_MASSAGE_INVALID_RELATED: "Sprawdź powiązane masaże.",
        ADMIN_MASSAGE_VARIANT_CODE_IMMUTABLE: "Kod istniejącego wariantu jest niezmienny.",
        ADMIN_MASSAGE_VARIANT_REMOVAL_FORBIDDEN: "Istniejących wariantów nie usuwamy — można je dezaktywować.",
        ADMIN_MASSAGE_NOT_FOUND: "Nie znaleziono masażu.",
      };
      return json({ success: false, message: messages[code] ?? "Nieprawidłowe dane." }, code === "ADMIN_MASSAGE_NOT_FOUND" ? 404 : 400);
    }
    if ((error as { code?: string })?.code === "23505") return json({ success: false, message: "Adres lub kod wariantu jest już zajęty." }, 409);
    if (!(error instanceof SyntaxError)) console.error("Admin massage save failed:", error);
    return json({ success: false, message: "Nie udało się zapisać masażu." }, error instanceof SyntaxError ? 400 : 500);
  }
}
