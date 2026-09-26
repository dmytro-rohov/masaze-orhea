import type { APIContext } from "astro";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { setAdminMassageActive } from "@/server/admin/admin-massages.service";

export const prerender = false;
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST({ request, locals }: APIContext) {
  if (!locals.admin) return json({ success: false, message: "Wymagane jest zalogowanie." }, 401);
  if (!isOwner(locals.admin) || !isSameOriginAdminRequest(request)) return json({ success: false, message: "Brak dostępu." }, 403);
  if (!(request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) return json({ success: false, message: "Nieprawidłowy format danych." }, 400);
  try {
    const data = await request.formData();
    const id = data.get("id");
    const active = data.get("active");
    if (typeof id !== "string" || !id || id.length > 100 || (active !== "true" && active !== "false")) return json({ success: false, message: "Nieprawidłowe dane." }, 400);
    const result = await setAdminMassageActive(locals.admin, id, active === "true");
    return json({ success: true, ...result }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ADMIN_MASSAGE_NOT_FOUND") return json({ success: false, message: "Nie znaleziono masażu." }, 404);
    if (code === "ADMIN_MASSAGE_VIP_EXISTS" || code === "ADMIN_MASSAGE_VIP_RESERVED" || code === "ADMIN_MASSAGE_CANNOT_REACTIVATE") return json({ success: false, message: "Nie można reaktywować tej oferty: sprawdź warianty, treść, obraz i strefę VIP." }, 400);
    console.error("Admin massage state change failed:", error);
    return json({ success: false, message: "Nie udało się zmienić statusu masażu." }, 500);
  }
}
