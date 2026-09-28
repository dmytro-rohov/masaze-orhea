import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "../../db";
import { voucherOrders, vouchers } from "../../db/schema";

const getVoucherValidityDays = (): number => {
  const rawValue =
    import.meta.env?.VOUCHER_VALIDITY_DAYS ?? process.env.VOUCHER_VALIDITY_DAYS;

  const validityDays = Number(rawValue);

  if (!Number.isInteger(validityDays) || validityDays <= 0) {
    throw new Error("VOUCHER_VALIDITY_DAYS_NOT_CONFIGURED");
  }

  return validityDays;
};

const createVoucherCode = (voucherOrderId: string): string => {
  const compactId = voucherOrderId
    .replaceAll("-", "")
    .slice(0, 16)
    .toUpperCase();

  return `ORHEA-${compactId}`;
};

export const hashVoucherBookingToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const createVoucherBookingToken = (): string =>
  randomBytes(32).toString("base64url");

const VOUCHER_BOOKING_TOKEN_CIPHERTEXT_VERSION = "v1";

const getVoucherBookingTokenEncryptionKey = (): Buffer => {
  const encodedKey = process.env.VOUCHER_BOOKING_TOKEN_ENCRYPTION_KEY?.trim();

  if (!encodedKey) {
    throw new Error("VOUCHER_BOOKING_TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED");
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== 32) {
    throw new Error("VOUCHER_BOOKING_TOKEN_ENCRYPTION_KEY_INVALID");
  }

  return key;
};

const encryptVoucherBookingToken = (token: string): string => {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getVoucherBookingTokenEncryptionKey(),
    initializationVector,
  );
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return [
    VOUCHER_BOOKING_TOKEN_CIPHERTEXT_VERSION,
    initializationVector.toString("base64url"),
    authenticationTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
};

const decryptVoucherBookingToken = (ciphertext: string): string => {
  const [version, initializationVector, authenticationTag, encryptedToken, ...rest] =
    ciphertext.split(".");

  if (
    version !== VOUCHER_BOOKING_TOKEN_CIPHERTEXT_VERSION ||
    !initializationVector ||
    !authenticationTag ||
    !encryptedToken ||
    rest.length > 0
  ) {
    throw new Error("VOUCHER_BOOKING_TOKEN_CIPHERTEXT_INVALID");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getVoucherBookingTokenEncryptionKey(),
      Buffer.from(initializationVector, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(authenticationTag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedToken, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error("VOUCHER_BOOKING_TOKEN_CIPHERTEXT_INVALID", {
        cause: error,
      });
    }

    throw error;
  }
};

const getVoucherBookingPublicOrigin = (): string => {
  const rawSiteUrl = process.env.SITE_URL?.trim();

  if (!rawSiteUrl) {
    throw new Error("SITE_URL_NOT_CONFIGURED");
  }

  let siteUrl: URL;

  try {
    siteUrl = new URL(rawSiteUrl);
  } catch (error) {
    throw new Error("SITE_URL_INVALID", { cause: error });
  }

  if (siteUrl.protocol !== "https:" && siteUrl.protocol !== "http:") {
    throw new Error("SITE_URL_INVALID");
  }

  return siteUrl.origin;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() + days);

  return result;
};

type IssueVoucherResult = {
  voucherId: string;
  voucherCode: string;
  alreadyIssued: boolean;
};

export const getVoucherBookingUrl = async (
  voucherId: string,
): Promise<string | null> => {
  const bookingToken = await db.transaction(async (tx) => {
    const [voucher] = await tx
      .select({
        id: vouchers.id,
        voucherType: vouchers.voucherType,
        bookingTokenHash: vouchers.bookingTokenHash,
        bookingTokenCiphertext: vouchers.bookingTokenCiphertext,
      })
      .from(vouchers)
      .where(eq(vouchers.id, voucherId))
      .limit(1)
      .for("update");

    if (!voucher) {
      throw new Error("VOUCHER_NOT_FOUND");
    }

    if (voucher.voucherType !== "service") {
      return null;
    }

    if (voucher.bookingTokenCiphertext) {
      const token = decryptVoucherBookingToken(voucher.bookingTokenCiphertext);

      if (hashVoucherBookingToken(token) !== voucher.bookingTokenHash) {
        throw new Error("VOUCHER_BOOKING_TOKEN_CIPHERTEXT_INVALID");
      }

      return token;
    }

    const token = createVoucherBookingToken();

    await tx
      .update(vouchers)
      .set({
        bookingTokenHash: hashVoucherBookingToken(token),
        bookingTokenCiphertext: encryptVoucherBookingToken(token),
        updatedAt: new Date(),
      })
      .where(eq(vouchers.id, voucher.id));

    return token;
  });

  if (!bookingToken) {
    return null;
  }

  return `${getVoucherBookingPublicOrigin()}/rezerwacja/voucher/${bookingToken}`;
};

export const issueVoucherForOrder = async (
  voucherOrderId: string,
): Promise<IssueVoucherResult> => {
  const validityDays = getVoucherValidityDays();

  return db.transaction(async (tx) => {
    const [existingVoucher] = await tx
      .select({
        id: vouchers.id,
        code: vouchers.code,
      })
      .from(vouchers)
      .where(eq(vouchers.voucherOrderId, voucherOrderId))
      .limit(1);

    if (existingVoucher) {
      return {
        voucherId: existingVoucher.id,
        voucherCode: existingVoucher.code,
        alreadyIssued: true,
      };
    }

    const [order] = await tx
      .select({
        id: voucherOrders.id,
        status: voucherOrders.status,
        voucherType: voucherOrders.voucherType,

        massageId: voucherOrders.massageId,
        massageVariantId: voucherOrders.massageVariantId,

        massageNameSnapshot: voucherOrders.massageNameSnapshot,
        durationMinutesSnapshot: voucherOrders.durationMinutesSnapshot,
        durationLabelSnapshot: voucherOrders.durationLabelSnapshot,
        bookingSlotMinutesSnapshot: voucherOrders.bookingSlotMinutesSnapshot,
        priceGroszeSnapshot: voucherOrders.priceGroszeSnapshot,

        amountGrosze: voucherOrders.amountGrosze,
        currency: voucherOrders.currency,

        recipientName: voucherOrders.recipientName,
        message: voucherOrders.message,
      })
      .from(voucherOrders)
      .where(eq(voucherOrders.id, voucherOrderId))
      .limit(1);

    if (!order) {
      throw new Error("VOUCHER_ORDER_NOT_FOUND");
    }

    if (order.status !== "paid") {
      throw new Error("VOUCHER_ORDER_NOT_PAID");
    }

    const issuedAt = new Date();

    const expiresAt = addDays(issuedAt, validityDays);

    const voucherCode = createVoucherCode(order.id);
    const bookingToken =
      order.voucherType === "service" ? createVoucherBookingToken() : null;

    const [createdVoucher] = await tx
      .insert(vouchers)
      .values({
        voucherOrderId: order.id,

        code: voucherCode,
        status: "active",
        voucherType: order.voucherType,

        massageId: order.massageId,
        massageVariantId: order.massageVariantId,

        massageNameSnapshot: order.massageNameSnapshot,
        durationMinutesSnapshot: order.durationMinutesSnapshot,
        durationLabelSnapshot: order.durationLabelSnapshot,
        bookingSlotMinutesSnapshot: order.bookingSlotMinutesSnapshot,
        priceGroszeSnapshot: order.priceGroszeSnapshot,

        bookingTokenHash: bookingToken
          ? hashVoucherBookingToken(bookingToken)
          : null,
        bookingTokenCiphertext: bookingToken
          ? encryptVoucherBookingToken(bookingToken)
          : null,

        amountGrosze: order.amountGrosze,
        currency: order.currency,

        recipientName: order.recipientName,
        message: order.message,

        issuedAt,
        expiresAt,
      })
      .onConflictDoNothing({
        target: vouchers.voucherOrderId,
      })
      .returning({
        id: vouchers.id,
        code: vouchers.code,
      });

    if (createdVoucher) {
      return {
        voucherId: createdVoucher.id,
        voucherCode: createdVoucher.code,
        alreadyIssued: false,
      };
    }

    const [concurrentVoucher] = await tx
      .select({
        id: vouchers.id,
        code: vouchers.code,
      })
      .from(vouchers)
      .where(eq(vouchers.voucherOrderId, order.id))
      .limit(1);

    if (!concurrentVoucher) {
      throw new Error("VOUCHER_ISSUANCE_FAILED");
    }

    return {
      voucherId: concurrentVoucher.id,
      voucherCode: concurrentVoucher.code,
      alreadyIssued: true,
    };
  });
};
