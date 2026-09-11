import {
  createHash,
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import type { AstroCookies } from "astro";

export const ADMIN_SESSION_COOKIE = "orhea_admin_session";

const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60;
const ADMIN_SESSION_VERSION = 1;
const ADMIN_PASSWORD_HASH_PREFIX = "scrypt";

export type AdminSession = {
  username: string;
  expiresAt: number;
};

export class AdminAuthConfigurationError extends Error {
  constructor() {
    super("ADMIN_AUTH_NOT_CONFIGURED");
    this.name = "AdminAuthConfigurationError";
  }
}

const getEnvValue = (name: string): string | undefined => {
  const value = import.meta.env?.[name] ?? process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const getAdminAuthConfig = () => {
  const username = getEnvValue("ADMIN_USERNAME");
  const passwordHash = getEnvValue("ADMIN_PASSWORD_HASH");
  const sessionSecret = getEnvValue("ADMIN_SESSION_SECRET");

  if (!username || !passwordHash || !sessionSecret || sessionSecret.length < 32) {
    throw new AdminAuthConfigurationError();
  }

  return { username, passwordHash, sessionSecret };
};

const safeStringEqual = (left: string, right: string): boolean => {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
};

const verifyPassword = (password: string, encodedHash: string): boolean => {
  const [prefix, encodedSalt, encodedDigest, extra] = encodedHash.split("$");

  if (
    prefix !== ADMIN_PASSWORD_HASH_PREFIX ||
    !encodedSalt ||
    !encodedDigest ||
    extra !== undefined
  ) {
    throw new AdminAuthConfigurationError();
  }

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedDigest = Buffer.from(encodedDigest, "base64url");

    if (salt.length < 16 || expectedDigest.length !== 64) {
      throw new AdminAuthConfigurationError();
    }

    const actualDigest = scryptSync(password, salt, expectedDigest.length);
    return timingSafeEqual(actualDigest, expectedDigest);
  } catch (error) {
    if (error instanceof AdminAuthConfigurationError) throw error;
    throw new AdminAuthConfigurationError();
  }
};

export const verifyAdminCredentials = (
  username: string,
  password: string,
): boolean => {
  const config = getAdminAuthConfig();
  const passwordMatches = verifyPassword(password, config.passwordHash);
  const usernameMatches = safeStringEqual(username, config.username);

  return usernameMatches && passwordMatches;
};

const signSessionPayload = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export const createAdminSessionToken = (username: string): string => {
  const { sessionSecret } = getAdminAuthConfig();
  const payload = Buffer.from(
    JSON.stringify({
      version: ADMIN_SESSION_VERSION,
      username,
      expiresAt: Math.floor(Date.now() / 1000) + ADMIN_SESSION_DURATION_SECONDS,
    }),
  ).toString("base64url");
  const signature = signSessionPayload(payload, sessionSecret);

  return `${payload}.${signature}`;
};

export const readAdminSession = (token?: string): AdminSession | null => {
  if (!token) return null;

  try {
    const { username: configuredUsername, sessionSecret } = getAdminAuthConfig();
    const [payload, signature, extra] = token.split(".");

    if (!payload || !signature || extra !== undefined) return null;

    const expectedSignature = signSessionPayload(payload, sessionSecret);
    if (!safeStringEqual(signature, expectedSignature)) return null;

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<{
      version: number;
      username: string;
      expiresAt: number;
    }>;

    if (
      decoded.version !== ADMIN_SESSION_VERSION ||
      typeof decoded.username !== "string" ||
      typeof decoded.expiresAt !== "number" ||
      decoded.expiresAt <= Math.floor(Date.now() / 1000) ||
      !safeStringEqual(decoded.username, configuredUsername)
    ) {
      return null;
    }

    return {
      username: decoded.username,
      expiresAt: decoded.expiresAt,
    };
  } catch {
    return null;
  }
};

const isProduction =
  import.meta.env?.PROD || process.env.NODE_ENV === "production";

export const setAdminSessionCookie = (
  cookies: AstroCookies,
  token: string,
): void => {
  cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_DURATION_SECONDS,
  });
};

export const clearAdminSessionCookie = (cookies: AstroCookies): void => {
  cookies.delete(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
};

export const getSafeAdminReturnTo = (value: string | null): string => {
  if (!value) return "/admin";

  try {
    const base = new URL("https://admin.orhea.local");
    const candidate = new URL(value, base);
    const isAdminPath =
      candidate.pathname === "/admin" || candidate.pathname.startsWith("/admin/");

    if (
      candidate.origin !== base.origin ||
      !isAdminPath ||
      candidate.pathname === "/admin/login"
    ) {
      return "/admin";
    }

    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return "/admin";
  }
};

export const isSameOriginAdminRequest = (request: Request): boolean => {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
};
