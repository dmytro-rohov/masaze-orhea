import { scryptSync, timingSafeEqual } from "node:crypto";

export class InvalidScryptHashError extends Error {
  constructor() {
    super("INVALID_SCRYPT_HASH");
  }
}

export const verifyScryptPassword = (password: string, encodedHash: string): boolean => {
  const [prefix, encodedSalt, encodedDigest, extra] = encodedHash.split("$");

  if (prefix !== "scrypt" || !encodedSalt || !encodedDigest || extra !== undefined) {
    throw new InvalidScryptHashError();
  }

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedDigest = Buffer.from(encodedDigest, "base64url");

    if (salt.length < 16 || expectedDigest.length !== 64) {
      throw new InvalidScryptHashError();
    }

    return timingSafeEqual(
      scryptSync(password, salt, expectedDigest.length),
      expectedDigest,
    );
  } catch {
    throw new InvalidScryptHashError();
  }
};
