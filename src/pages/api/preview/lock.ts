import type { APIContext } from "astro";
import {
  clearSitePreviewCookie,
  isSameOriginSitePreviewRequest,
} from "@/server/preview/site-preview.service";

export const prerender = false;

export function POST({ request, cookies }: APIContext) {
  if (!isSameOriginSitePreviewRequest(request)) {
    return new Response(JSON.stringify({ success: false }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  clearSitePreviewCookie(cookies);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
