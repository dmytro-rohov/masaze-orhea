import type { APIContext } from "astro";

import {
  clearAdminSessionCookie,
  isSameOriginAdminRequest,
} from "@/server/admin/admin-auth.service";

export const prerender = false;

export function POST({ request, url, cookies }: APIContext) {
  if (!isSameOriginAdminRequest(request)) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Nieprawidłowe źródło żądania.",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  clearAdminSessionCookie(cookies);
  return Response.redirect(new URL("/admin/login", url), 303);
}

export function GET() {
  return new Response(
    JSON.stringify({
      success: false,
      message: "Ta metoda nie jest obsługiwana.",
    }),
    {
      status: 405,
      headers: { "Content-Type": "application/json" },
    },
  );
}
