// @ts-check
import "dotenv/config";
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";

const site = process.env.SITE_URL || "http://localhost:4321";
const isStaging = process.env.PUBLIC_SITE_ENV === "staging";
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

  integrations: isStaging
    ? []
    : [
        sitemap({
          filter: (page) => {
            const pathname = new URL(page).pathname;

            return !(
              pathname === "/robots.txt" ||
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
