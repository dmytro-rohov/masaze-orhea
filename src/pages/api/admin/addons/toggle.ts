import type { APIContext } from "astro";
import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { setAdminAddonActive } from "@/server/admin/admin-addons.service";

export const prerender = false;
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST({ request, locals }: APIContext) {
  if (!locals.admin)
    return json({ success: false, message: "Wymagane jest zalogowanie." }, 401);
  if (!isOwner(locals.admin) || !isSameOriginAdminRequest(request))
    return json({ success: false, message: "Brak dostępu." }, 403);
  if (
    !(request.headers.get("content-type") ?? "").includes(
      "application/x-www-form-urlencoded",
    )
  )
    return json(
      { success: false, message: "Nieprawidłowy format danych." },
      400,
    );
  const data = await request.formData();
  const id = data.get("id");
  const value = data.get("isActive");
  if (typeof id !== "string" || (value !== "true" && value !== "false"))
    return json({ success: false, message: "Nieprawidłowe dane." }, 400);
  try {
    await setAdminAddonActive(locals.admin, id, value === "true");
    return json({ success: true }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ADMIN_ADDON_INVALID_INPUT")
      return json({ success: false, message: "Nieprawidłowy dodatek." }, 400);
    if (code === "ADMIN_ADDON_NOT_FOUND")
      return json({ success: false, message: "Nie znaleziono dodatku." }, 404);
    console.error("Admin addon toggle failed:", error);
    return json(
      { success: false, message: "Nie udało się zmienić statusu." },
      500,
    );
  }
}
