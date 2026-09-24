// @ts-check
import "dotenv/config";
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";
import { massages } from "./src/data/massages.ts";

const site = process.env.SITE_URL || "http://localhost:4321";
const isStaging = process.env.PUBLIC_SITE_ENV === "staging";
const isPreview = process.env.SITE_PREVIEW_ENABLED === "true";
const configuredSite = new URL(site);
const configuredDomain = {
  protocol: configuredSite.protocol.replace(":", ""),
  hostname: configuredSite.hostname,
};

export default defineConfig({
  site,
  output: "server",

  adapter: node({
    mode: "standalone",
  }),

  vite: {
    resolve: {
      alias: {
        "@": "/src",
        "@components": "/src/components",
        "@styles": "/src/styles",
        "@scripts": "/scripts",
        "@assets": "/src/assets",
      },
    },
  },

  integrations: isStaging || isPreview
    ? []
    : [
        sitemap({
          // Service pages are SSR so their requests always pass through the preview gate.
          customPages: massages.map(({ slug }) => new URL(`/uslugi/${slug}`, site).toString()),
          filter: (page) => {
            const pathname = new URL(page).pathname.replace(/\/+$/, "") || "/";

            return !(
              pathname === "/robots.txt" ||
              pathname === "/preview" ||
              pathname === "/admin" ||
              pathname.startsWith("/admin/") ||
              pathname === "/api" ||
              pathname.startsWith("/api/")
            );
          },
        }),
      ],

  security: {
    checkOrigin: true,
    allowedDomains: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
      configuredDomain,
    ],
  },
});
