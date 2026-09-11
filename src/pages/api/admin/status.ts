import type { APIContext } from "astro";

export const prerender = false;

export function GET({ locals }: APIContext) {
  return new Response(
    JSON.stringify({
      success: true,
      authenticated: true,
      admin: { username: locals.admin?.username },
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
