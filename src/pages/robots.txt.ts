import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site, url }) => {
  if (
    import.meta.env.PUBLIC_SITE_ENV === "staging" ||
    (process.env.SITE_PREVIEW_ENABLED ?? import.meta.env.SITE_PREVIEW_ENABLED) === "true"
  ) {
    return new Response(["User-agent: *", "Disallow: /", ""].join("\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

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
