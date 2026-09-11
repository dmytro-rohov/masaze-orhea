import {
  createHash,
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import type { AstroCookies } from "astro";
import type { SpecialistId } from "@/data/specialists";

export const ADMIN_SESSION_COOKIE = "orhea_admin_session";

const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60;
const ADMIN_SESSION_VERSION = 2;
const ADMIN_PASSWORD_HASH_PREFIX = "scrypt";

export type AdminRole = "owner" | "specialist";

export type AdminIdentity = {
  username: string;
  role: AdminRole;
  specialistId: SpecialistId | null;
};

export type AdminSession = AdminIdentity & {
  expiresAt: number;
};

export class AdminAuthConfigurationError extends Error {
  constructor() {
    super("ADMIN_AUTH_NOT_CONFIGURED");
    this.name = "AdminAuthConfigurationError";
  }
}

type AdminCredential = AdminIdentity & {
  passwordHash: string;
};

const normalizeEnvValue = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const getAdminAuthConfig = () => {
  const ownerUsername = normalizeEnvValue(
    import.meta.env.ADMIN_OWNER_USERNAME ?? process.env.ADMIN_OWNER_USERNAME,
  );

  const ownerPasswordHash = normalizeEnvValue(
    import.meta.env.ADMIN_OWNER_PASSWORD_HASH ??
      process.env.ADMIN_OWNER_PASSWORD_HASH,
  );

  const adrianUsername = normalizeEnvValue(
    import.meta.env.ADMIN_ADRIAN_USERNAME ?? process.env.ADMIN_ADRIAN_USERNAME,
  );

  const adrianPasswordHash = normalizeEnvValue(
    import.meta.env.ADMIN_ADRIAN_PASSWORD_HASH ??
      process.env.ADMIN_ADRIAN_PASSWORD_HASH,
  );

  const aleksandraUsername = normalizeEnvValue(
    import.meta.env.ADMIN_ALEKSANDRA_USERNAME ??
      process.env.ADMIN_ALEKSANDRA_USERNAME,
  );

  const aleksandraPasswordHash = normalizeEnvValue(
    import.meta.env.ADMIN_ALEKSANDRA_PASSWORD_HASH ??
      process.env.ADMIN_ALEKSANDRA_PASSWORD_HASH,
  );

  const sessionSecret = normalizeEnvValue(
    import.meta.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET,
  );

  if (
    !ownerUsername ||
    !ownerPasswordHash ||
    !adrianUsername ||
    !adrianPasswordHash ||
    !aleksandraUsername ||
    !aleksandraPasswordHash ||
    !sessionSecret ||
    sessionSecret.length < 32
  ) {
    throw new AdminAuthConfigurationError();
  }

  const credentials: AdminCredential[] = [
    {
      username: ownerUsername,
      passwordHash: ownerPasswordHash,
      role: "owner",
      specialistId: null,
    },
    {
      username: adrianUsername,
      passwordHash: adrianPasswordHash,
      role: "specialist",
      specialistId: "adrian",
    },
    {
      username: aleksandraUsername,
      passwordHash: aleksandraPasswordHash,
      role: "specialist",
      specialistId: "aleksandra",
    },
  ];

  if (new Set(credentials.map(({ username }) => username)).size !== 3) {
    throw new AdminAuthConfigurationError();
  }

  return {
    credentials,
    sessionSecret,
  };
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
    if (error instanceof AdminAuthConfigurationError) {
      throw error;
    }

    throw new AdminAuthConfigurationError();
  }
};

export const verifyAdminCredentials = (
  username: string,
  password: string,
): AdminIdentity | null => {
  const { credentials } = getAdminAuthConfig();

  const credential = credentials.find(({ username: configuredUsername }) =>
    safeStringEqual(username, configuredUsername),
  );

  if (!credential) {
    verifyPassword(password, credentials[0].passwordHash);
    return null;
  }

  if (!verifyPassword(password, credential.passwordHash)) {
    return null;
  }

  return {
    username: credential.username,
    role: credential.role,
    specialistId: credential.specialistId,
  };
};

const signSessionPayload = (payload: string, secret: string): string => {
  return createHmac("sha256", secret).update(payload).digest("base64url");
};

export const createAdminSessionToken = (identity: AdminIdentity): string => {
  const { sessionSecret } = getAdminAuthConfig();

  const payload = Buffer.from(
    JSON.stringify({
      version: ADMIN_SESSION_VERSION,
      username: identity.username,
      role: identity.role,
      specialistId: identity.specialistId,
      expiresAt: Math.floor(Date.now() / 1000) + ADMIN_SESSION_DURATION_SECONDS,
    }),
  ).toString("base64url");

  const signature = signSessionPayload(payload, sessionSecret);

  return `${payload}.${signature}`;
};

export const readAdminSession = (token?: string): AdminSession | null => {
  if (!token) return null;

  try {
    const { credentials, sessionSecret } = getAdminAuthConfig();

    const [payload, signature, extra] = token.split(".");

    if (!payload || !signature || extra !== undefined) {
      return null;
    }

    const expectedSignature = signSessionPayload(payload, sessionSecret);

    if (!safeStringEqual(signature, expectedSignature)) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<{
      version: number;
      username: string;
      role: AdminRole;
      specialistId: SpecialistId | null;
      expiresAt: number;
    }>;

    const sessionUsername = decoded.username;

    const configuredIdentity =
      typeof sessionUsername === "string"
        ? credentials.find(({ username }) =>
            safeStringEqual(sessionUsername, username),
          )
        : undefined;

    if (
      decoded.version !== ADMIN_SESSION_VERSION ||
      typeof decoded.username !== "string" ||
      (decoded.role !== "owner" && decoded.role !== "specialist") ||
      typeof decoded.expiresAt !== "number" ||
      decoded.expiresAt <= Math.floor(Date.now() / 1000) ||
      !configuredIdentity ||
      decoded.role !== configuredIdentity.role ||
      decoded.specialistId !== configuredIdentity.specialistId
    ) {
      return null;
    }

    return {
      username: configuredIdentity.username,
      role: configuredIdentity.role,
      specialistId: configuredIdentity.specialistId,
      expiresAt: decoded.expiresAt,
    };
  } catch {
    return null;
  }
};

const isProduction =
  import.meta.env.PROD || process.env.NODE_ENV === "production";

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
      candidate.pathname === "/admin" ||
      candidate.pathname.startsWith("/admin/");

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
