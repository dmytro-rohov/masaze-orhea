import type { APIRoute } from "astro";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { clearMassageMedia, setMassageMedia, VIDEO_LIMIT, type MassageMediaKind } from "@/server/media/massage-media.service";

export const prerender = false;
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const validKind = (value: unknown): value is MassageMediaKind =>
  value === "main_image" || value === "hero_image" || value === "hero_video";
const errorResponse = (error: unknown) => {
  const code = error instanceof Error ? error.message : "";
  if (code === "MEDIA_MASSAGE_NOT_FOUND") return json({ success: false, message: "Nie znaleziono masażu." }, 404);
  if (code === "MEDIA_FILE_TOO_LARGE") return json({ success: false, message: "Plik jest zbyt duży." }, 413);
  if (code === "MEDIA_INVALID_IMAGE" || code === "MEDIA_INVALID_VIDEO") return json({ success: false, message: "Nieprawidłowy lub uszkodzony plik." }, 400);
  if (code === "MEDIA_INVALID_REQUEST") return json({ success: false, message: "Nieprawidłowe dane." }, 400);
  if (error instanceof SyntaxError) return json({ success: false, message: "Nieprawidłowe dane." }, 400);
  console.error("Massage media operation failed:", error);
  return json({ success: false, message: "Nie udało się zapisać medium." }, 500);
};

const authorize = (locals: App.Locals, request: Request) => {
  if (!locals.admin) return json({ success: false, message: "Wymagane jest zalogowanie." }, 401);
  if (!isOwner(locals.admin) || !isSameOriginAdminRequest(request)) return json({ success: false, message: "Brak dostępu." }, 403);
  return null;
};

export const POST: APIRoute = async ({ request, locals, params }) => {
  const denied = authorize(locals, request);
  if (denied) return denied;
  if (!(request.headers.get("content-type") ?? "").startsWith("multipart/form-data;")) return json({ success: false, message: "Wymagany formularz z plikiem." }, 400);
  // Bound the entire multipart body before parsing: File.size alone is too late.
  const maxBody = VIDEO_LIMIT + 1024 * 1024;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBody) return json({ success: false, message: "Plik jest zbyt duży." }, 413);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ success: false, message: "Brak pliku." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBody) { await reader.cancel(); return json({ success: false, message: "Plik jest zbyt duży." }, 413); }
      chunks.push(value);
    }
    const bounded = new Request(request.url, { method: "POST", headers: request.headers, body: Buffer.concat(chunks, length) });
    const form = await bounded.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if (!validKind(kind) || !(file instanceof File)) return json({ success: false, message: "Nieprawidłowy plik." }, 400);
    const media = await setMassageMedia(locals.admin!, params.id ?? "", kind, file);
    return json({ success: true, media }, 200);
  } catch (error) { return errorResponse(error); }
};

export const DELETE: APIRoute = async ({ request, locals, params }) => {
  const denied = authorize(locals, request);
  if (denied) return denied;
  try {
    const body = await request.text();
    if (body.length > 1000) return json({ success: false, message: "Nieprawidłowe dane." }, 400);
    const payload = JSON.parse(body) as { kind?: unknown };
    if (!validKind(payload?.kind)) return json({ success: false, message: "Nieprawidłowe dane." }, 400);
    return json({ success: true, ...await clearMassageMedia(locals.admin!, params.id ?? "", payload.kind) }, 200);
  } catch (error) { return errorResponse(error); }
};
