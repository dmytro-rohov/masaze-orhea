import type { APIContext } from "astro";
import {
  createSitePreviewToken,
  getSafeSitePreviewReturnTo,
  isSameOriginSitePreviewRequest,
  isSitePreviewEnabled,
  setSitePreviewCookie,
  SitePreviewConfigurationError,
  verifySitePreviewPassword,
} from "@/server/preview/site-preview.service";

export const prerender = false;

const reply = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export async function POST({ request, cookies }: APIContext) {
  if (!isSameOriginSitePreviewRequest(request)) {
    return reply({ success: false, message: "Nieprawidłowe źródło żądania." }, 403);
  }

  if (!isSitePreviewEnabled()) {
    return reply({ success: false, message: "Podgląd strony nie jest aktywny." }, 404);
  }

  if (!(request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    return reply({ success: false, message: "Nieprawidłowy format danych." }, 400);
  }

  const form = await request.formData();
  const password = form.get("password");
  const returnTo = getSafeSitePreviewReturnTo(
    typeof form.get("returnTo") === "string" ? String(form.get("returnTo")) : null,
  );

  if (typeof password !== "string" || !password || password.length > 512) {
    return reply({ success: false, message: "Nieprawidłowe hasło." }, 401);
  }

  try {
    if (!verifySitePreviewPassword(password)) {
      return reply({ success: false, message: "Nieprawidłowe hasło." }, 401);
    }

    setSitePreviewCookie(cookies, createSitePreviewToken());
    return reply({ success: true, redirectTo: returnTo }, 200);
  } catch (error) {
    if (error instanceof SitePreviewConfigurationError) {
      return reply({ success: false, message: "Podgląd strony jest chwilowo niedostępny." }, 503);
    }
    throw error;
  }
}
