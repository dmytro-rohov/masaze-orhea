import type { APIContext } from "astro";
import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { saveAdminAddon } from "@/server/admin/admin-addons.service";

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
  const get = (key: string) => data.get(key);
  const fields = [
    "id",
    "name",
    "description",
    "pricePLN",
    "treatmentDurationMinutes",
    "slotExtensionMinutes",
    "notes",
  ] as const;
  if (
    fields.some(
      (field) => get(field) !== null && typeof get(field) !== "string",
    ) ||
    typeof get("name") !== "string" ||
    typeof get("pricePLN") !== "string" ||
    typeof get("slotExtensionMinutes") !== "string"
  )
    return json({ success: false, message: "Nieprawidłowe dane." }, 400);
  const massageIds = data.getAll("massageIds");
  if (!massageIds.every((id): id is string => typeof id === "string"))
    return json({ success: false, message: "Nieprawidłowe przypisania." }, 400);
  try {
    const result = await saveAdminAddon(locals.admin, {
      id: String(get("id") ?? "") || undefined,
      name: String(get("name")),
      description: String(get("description") ?? ""),
      pricePLN: String(get("pricePLN")),
      treatmentDurationMinutes: String(get("treatmentDurationMinutes") ?? ""),
      slotExtensionMinutes: String(get("slotExtensionMinutes")),
      notes: String(get("notes") ?? ""),
      isActive: get("isActive") === "on",
      isConfirmed: get("isConfirmed") === "on",
      massageIds,
    });
    return json({ success: true, ...result }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (
      ["ADMIN_ADDON_INVALID_INPUT", "ADMIN_ADDON_INVALID_MASSAGE"].includes(
        code,
      )
    )
      return json(
        {
          success: false,
          message: "Sprawdź pola formularza i przypisane masaże.",
        },
        400,
      );
    if (code === "ADMIN_ADDON_NOT_FOUND")
      return json({ success: false, message: "Nie znaleziono dodatku." }, 404);
    console.error("Admin addon save failed:", error);
    return json(
      { success: false, message: "Nie udało się zapisać dodatku." },
      500,
    );
  }
}
