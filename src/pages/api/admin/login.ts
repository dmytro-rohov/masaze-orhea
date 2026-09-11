import type { APIContext } from "astro";

import {
  AdminAuthConfigurationError,
  createAdminSessionToken,
  getSafeAdminReturnTo,
  isSameOriginAdminRequest,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/server/admin/admin-auth.service";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const wantsJson = (request: Request): boolean =>
  request.headers.get("accept")?.includes("application/json") ?? false;

const loginRedirect = (url: URL, error: string, returnTo: string): Response => {
  const target = new URL("/admin/login", url);
  target.searchParams.set("error", error);
  target.searchParams.set("next", returnTo);
  return Response.redirect(target, 303);
};

export async function POST(context: APIContext) {
  const { request, url, cookies } = context;

  if (!isSameOriginAdminRequest(request)) {
    return wantsJson(request)
      ? jsonResponse(
          { success: false, message: "Nieprawidłowe źródło żądania." },
          403,
        )
      : loginRedirect(url, "request", "/admin");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return jsonResponse(
      { success: false, message: "Nieprawidłowy format danych." },
      400,
    );
  }

  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const returnTo = getSafeAdminReturnTo(
    typeof formData.get("returnTo") === "string"
      ? String(formData.get("returnTo"))
      : null,
  );

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password ||
    username.length > 100 ||
    password.length > 512
  ) {
    return wantsJson(request)
      ? jsonResponse(
          { success: false, message: "Nieprawidłowy login lub hasło." },
          401,
        )
      : loginRedirect(url, "invalid", returnTo);
  }

  try {
    if (!verifyAdminCredentials(username.trim(), password)) {
      return wantsJson(request)
        ? jsonResponse(
            { success: false, message: "Nieprawidłowy login lub hasło." },
            401,
          )
        : loginRedirect(url, "invalid", returnTo);
    }

    setAdminSessionCookie(cookies, createAdminSessionToken(username.trim()));

    if (wantsJson(request)) {
      return jsonResponse({ success: true, redirectTo: returnTo }, 200);
    }

    return Response.redirect(new URL(returnTo, url), 303);
  } catch (error) {
    if (error instanceof AdminAuthConfigurationError) {
      return wantsJson(request)
        ? jsonResponse(
            {
              success: false,
              message: "Logowanie administratora jest chwilowo niedostępne.",
            },
            503,
          )
        : loginRedirect(url, "configuration", returnTo);
    }

    throw error;
  }
}

export function GET() {
  return jsonResponse(
    { success: false, message: "Ta metoda nie jest obsługiwana." },
    405,
  );
}
