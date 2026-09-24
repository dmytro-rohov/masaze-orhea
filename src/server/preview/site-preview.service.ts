import { createHmac, timingSafeEqual } from "node:crypto";

import type { AstroCookies } from "astro";
import { verifyScryptPassword } from "@/server/security/scrypt-password";

export const SITE_PREVIEW_COOKIE = "orhea_site_preview";
const PREVIEW_VERSION = 1;
const PREVIEW_DURATION_SECONDS = 7 * 24 * 60 * 60;

export class SitePreviewConfigurationError extends Error {
  constructor() {
    super("SITE_PREVIEW_NOT_CONFIGURED");
  }
}

export const isSitePreviewEnabled = (): boolean =>
  (process.env.SITE_PREVIEW_ENABLED ?? import.meta.env.SITE_PREVIEW_ENABLED) === "true";

const getConfig = () => {
  const passwordHash = (
    process.env.SITE_PREVIEW_PASSWORD_HASH ?? import.meta.env.SITE_PREVIEW_PASSWORD_HASH
  )?.trim();
  const sessionSecret = (
    process.env.SITE_PREVIEW_SESSION_SECRET ?? import.meta.env.SITE_PREVIEW_SESSION_SECRET
  )?.trim();

  if (!passwordHash || !sessionSecret || sessionSecret.length < 32) {
    throw new SitePreviewConfigurationError();
  }

  return { passwordHash, sessionSecret };
};

const sign = (payload: string, passwordHash: string, secret: string): string =>
  createHmac("sha256", secret)
    .update(`site-preview-v${PREVIEW_VERSION}:`)
    .update(passwordHash)
    .update(":")
    .update(payload)
    .digest("base64url");

export const verifySitePreviewPassword = (password: string): boolean => {
  const { passwordHash } = getConfig();

  try {
    return verifyScryptPassword(password, passwordHash);
  } catch {
    throw new SitePreviewConfigurationError();
  }
};

export const createSitePreviewToken = (): string => {
  const { passwordHash, sessionSecret } = getConfig();
  const payload = Buffer.from(
    JSON.stringify({
      version: PREVIEW_VERSION,
      expiresAt: Math.floor(Date.now() / 1000) + PREVIEW_DURATION_SECONDS,
    }),
  ).toString("base64url");

  return `${payload}.${sign(payload, passwordHash, sessionSecret)}`;
};

export const hasValidSitePreviewToken = (token?: string): boolean => {
  if (!token || token.length > 2048) return false;

  try {
    const { passwordHash, sessionSecret } = getConfig();
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined) return false;

    const actual = Buffer.from(signature, "base64url");
    const expected = Buffer.from(sign(payload, passwordHash, sessionSecret), "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      version?: unknown;
      expiresAt?: unknown;
    };

    return (
      decoded.version === PREVIEW_VERSION &&
      typeof decoded.expiresAt === "number" &&
      Number.isInteger(decoded.expiresAt) &&
      decoded.expiresAt > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
};

const isProduction = import.meta.env.PROD || process.env.NODE_ENV === "production";

export const setSitePreviewCookie = (cookies: AstroCookies, token: string): void => {
  cookies.set(SITE_PREVIEW_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: PREVIEW_DURATION_SECONDS,
  });
};

export const clearSitePreviewCookie = (cookies: AstroCookies): void => {
  cookies.delete(SITE_PREVIEW_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
};

export const getSafeSitePreviewReturnTo = (value: string | null): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  try {
    const base = new URL("https://preview.orhea.local");
    const target = new URL(value, base);

    if (
      target.origin !== base.origin ||
      target.pathname === "/preview" ||
      target.pathname.startsWith("/api/") ||
      target.pathname === "/admin" ||
      target.pathname.startsWith("/admin/")
    ) {
      return "/";
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
};

export const isSameOriginSitePreviewRequest = (request: Request): boolean => {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
};
