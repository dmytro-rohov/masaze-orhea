import type { APIContext } from "astro";

export const prerender = false;

export function GET({ locals }: APIContext) {
  return new Response(
    JSON.stringify({
      success: true,
      authenticated: true,
      admin: locals.admin
        ? {
            username: locals.admin.username,
            role: locals.admin.role,
            specialistId: locals.admin.specialistId,
          }
        : null,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
