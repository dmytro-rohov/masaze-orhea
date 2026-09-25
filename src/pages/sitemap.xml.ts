import type { APIRoute } from "astro";
import { getPublicMassageCatalog } from "@/server/catalog/massage-catalog.service";

export const prerender = false;

const publicPaths = [
  "/", "/uslugi", "/cennik", "/rezerwacja", "/voucher", "/kontakt",
  "/o-nas", "/faq", "/przed-pierwsza-wizyta", "/polityka-prywatnosci", "/regulamin",
];

export const GET: APIRoute = async ({ site, url }) => {
  if (import.meta.env.PUBLIC_SITE_ENV === "staging" ||
    (process.env.SITE_PREVIEW_ENABLED ?? import.meta.env.SITE_PREVIEW_ENABLED) === "true") {
    return new Response("", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });
  }
  const origin = site ?? url.origin;
  const escaped = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const catalog = await getPublicMassageCatalog();
  const paths = [...publicPaths, ...catalog.map((massage) => `/uslugi/${encodeURIComponent(massage.slug)}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((path) => `  <url><loc>${escaped(new URL(path, origin).toString())}</loc></url>`)
    .join("\n")}\n</urlset>`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
};
