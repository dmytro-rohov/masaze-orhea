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
        priceGroszeSnapshot: order.priceGroszeSnapshot,

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
