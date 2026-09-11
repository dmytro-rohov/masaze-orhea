import { defineMiddleware } from "astro:middleware";

import {
  ADMIN_SESSION_COOKIE,
  readAdminSession,
} from "@/server/admin/admin-auth.service";

const isAdminPage = (pathname: string): boolean =>
  pathname === "/admin" || pathname.startsWith("/admin/");

const isAdminApi = (pathname: string): boolean =>
  pathname === "/api/admin" || pathname.startsWith("/api/admin/");

const isPublicAdminRoute = (pathname: string): boolean =>
  pathname === "/admin/login" || pathname === "/api/admin/login";

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

  if (!handlesAdminRoute) return next();

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

  return addAdminSecurityHeaders(await next());
});
