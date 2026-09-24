import { defineMiddleware } from "astro:middleware";

import {
  ADMIN_SESSION_COOKIE,
  readAdminSession,
} from "@/server/admin/admin-auth.service";
import {
  isOwner,
  isOwnerOnlyAdminRoute,
} from "@/server/admin/admin-authorization.service";
import {
  hasValidSitePreviewToken,
  isSitePreviewEnabled,
  SITE_PREVIEW_COOKIE,
} from "@/server/preview/site-preview.service";

const isAdminPage = (pathname: string): boolean =>
  pathname === "/admin" || pathname.startsWith("/admin/");

const isAdminApi = (pathname: string): boolean =>
  pathname === "/api/admin" || pathname.startsWith("/api/admin/");

const isApiRoute = (pathname: string): boolean =>
  pathname === "/api" || pathname.startsWith("/api/");

const isPublicAdminRoute = (pathname: string): boolean =>
  pathname === "/admin/login" || pathname === "/api/admin/login";

const isPreviewGateExempt = (pathname: string, method: string): boolean =>
  pathname === "/preview" ||
  pathname === "/robots.txt" ||
  pathname === "/api/preview/unlock" ||
  pathname === "/api/preview/lock" ||
  pathname === "/api/stripe/webhook" ||
  isAdminPage(pathname) ||
  isAdminApi(pathname) ||
  ((method === "GET" || method === "HEAD") &&
    (pathname.startsWith("/_astro/") ||
      pathname.startsWith("/_image") ||
      pathname.startsWith("/icons/") ||
      pathname.startsWith("/fonts/") ||
      pathname.startsWith("/favicon.")));

const addPreviewNoIndexHeader = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Cache-Control", "private, no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const addTechnicalNoIndexHeader = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const addAdminSecurityHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  headers.set("Referrer-Policy", "no-referrer");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const handlesAdminRoute = isAdminPage(pathname) || isAdminApi(pathname);
  const previewEnabled = isSitePreviewEnabled();

  if (
    previewEnabled &&
    !isPreviewGateExempt(pathname, context.request.method) &&
    !hasValidSitePreviewToken(context.cookies.get(SITE_PREVIEW_COOKIE)?.value)
  ) {
    if (isApiRoute(pathname)) {
      return addPreviewNoIndexHeader(
        new Response(JSON.stringify({ success: false, message: "Strona wymaga hasła dostępu." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    const previewUrl = new URL("/preview", context.url);
    previewUrl.searchParams.set("returnTo", `${pathname}${search}`);
    return addPreviewNoIndexHeader(context.redirect(previewUrl.pathname + previewUrl.search, 302));
  }

  if (!handlesAdminRoute) {
    const response = await next();

    return previewEnabled
      ? addPreviewNoIndexHeader(response)
      : isApiRoute(pathname)
      ? addTechnicalNoIndexHeader(response)
      : response;
  }

  const session = readAdminSession(
    context.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (session) context.locals.admin = session;

  if (!isPublicAdminRoute(pathname) && !session) {
    if (isAdminApi(pathname)) {
      return addAdminSecurityHeaders(
        new Response(
          JSON.stringify({
            success: false,
            message: "Wymagane jest zalogowanie do panelu administracyjnego.",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    const nextPath = `${pathname}${search}`;
    return context.redirect(
      `/admin/login?next=${encodeURIComponent(nextPath)}`,
      302,
    );
  }

  if (session && isOwnerOnlyAdminRoute(pathname) && !isOwner(session)) {
    if (isAdminApi(pathname)) {
      return addAdminSecurityHeaders(
        new Response(
          JSON.stringify({
            success: false,
            message: "Nie masz uprawnień do tego zasobu.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    return addAdminSecurityHeaders(context.redirect("/admin", 302));
  }

  return addAdminSecurityHeaders(await next());
});
