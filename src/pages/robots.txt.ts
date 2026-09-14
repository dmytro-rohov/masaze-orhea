import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site, url }) => {
  const publicOrigin = site ?? url.origin;
  const sitemapUrl = new URL("sitemap-index.xml", publicOrigin);

  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /api",
      `Sitemap: ${sitemapUrl.toString()}`,
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
};
