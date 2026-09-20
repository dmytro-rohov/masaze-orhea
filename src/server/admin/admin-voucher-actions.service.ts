import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { voucherEvents, voucherOrders, vouchers } from "@/db/schema";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import { isOwner } from "@/server/admin/admin-authorization.service";
import { deliverVoucherEmail } from "@/server/vouchers/voucher-email.service";
import { generateVoucherPdf } from "@/server/vouchers/voucher-pdf.service";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdminVoucherActionFailure = {
  success: false;
  reason: "not_found" | "invalid_transition" | "delivery_failed";
};

export const redeemAdminVoucher = async (
  session: AdminSession,
  voucherId: string,
) => {
  if (!isOwner(session) || !uuidPattern.test(voucherId)) {
    return { success: false, reason: "not_found" } as const;
  }

  return db.transaction(async (tx) => {
    const [voucher] = await tx
      .select({ id: vouchers.id, status: vouchers.status })
      .from(vouchers)
      .where(eq(vouchers.id, voucherId))
      .limit(1)
      .for("update");

    if (!voucher) {
      return { success: false, reason: "not_found" } as const;
    }

    if (voucher.status === "redeemed") {
      return {
        success: true,
        voucherId: voucher.id,
        status: "redeemed" as const,
        alreadyApplied: true,
      };
    }

    if (voucher.status !== "active") {
      return { success: false, reason: "invalid_transition" } as const;
    }

    const redeemedAt = new Date();

    await tx
      .update(vouchers)
      .set({
        status: "redeemed",
        redeemedAt,
        updatedAt: redeemedAt,
      })
      .where(eq(vouchers.id, voucher.id));

    await tx.insert(voucherEvents).values({
      voucherId: voucher.id,
      eventType: "redeemed",
      actorUsername: session.username,
      actorRole: session.role,
      createdAt: redeemedAt,
    });

    return {
      success: true,
      voucherId: voucher.id,
      status: "redeemed" as const,
      alreadyApplied: false,
    };
  });
};

export const restoreAdminVoucher = async (
  session: AdminSession,
  voucherId: string,
) => {
  if (!isOwner(session) || !uuidPattern.test(voucherId)) {
    return { success: false, reason: "not_found" } as const;
  }

  return db.transaction(async (tx) => {
    const [voucher] = await tx
      .select({ id: vouchers.id, status: vouchers.status })
      .from(vouchers)
      .where(eq(vouchers.id, voucherId))
      .limit(1)
      .for("update");

    if (!voucher) {
      return { success: false, reason: "not_found" } as const;
    }

    if (voucher.status !== "redeemed") {
      return { success: false, reason: "invalid_transition" } as const;
    }

    const restoredAt = new Date();

    await tx
      .update(vouchers)
      .set({
        status: "active",
        redeemedAt: null,
        updatedAt: restoredAt,
      })
      .where(eq(vouchers.id, voucher.id));

    await tx.insert(voucherEvents).values({
      voucherId: voucher.id,
      eventType: "restored",
      actorUsername: session.username,
      actorRole: session.role,
      createdAt: restoredAt,
    });

    return {
      success: true,
      voucherId: voucher.id,
      status: "active" as const,
      alreadyApplied: false,
    };
  });
};

export const markPaperVoucherAsSent = async (
  session: AdminSession,
  orderId: string,
) => {
  if (!isOwner(session) || !uuidPattern.test(orderId)) {
    return { success: false, reason: "not_found" } as const;
  }

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: voucherOrders.id,
        status: voucherOrders.status,
        deliveryType: voucherOrders.deliveryType,
        paperSentAt: voucherOrders.paperSentAt,
      })
      .from(voucherOrders)
      .where(eq(voucherOrders.id, orderId))
      .limit(1)
      .for("update");

    if (!order) {
      return { success: false, reason: "not_found" } as const;
    }

    if (order.deliveryType !== "paper" || order.status !== "paid") {
      return { success: false, reason: "invalid_transition" } as const;
    }

    const [issuedVoucher] = await tx
      .select({ id: vouchers.id })
      .from(vouchers)
      .where(eq(vouchers.voucherOrderId, order.id))
      .limit(1);

    if (!issuedVoucher) {
      return { success: false, reason: "invalid_transition" } as const;
    }

    if (order.paperSentAt) {
      return {
        success: true,
        orderId: order.id,
        paperSentAt: order.paperSentAt,
        alreadyApplied: true,
      } as const;
    }

    const paperSentAt = new Date();
    await tx
      .update(voucherOrders)
      .set({ paperSentAt, updatedAt: paperSentAt })
      .where(eq(voucherOrders.id, order.id));

    return {
      success: true,
      orderId: order.id,
      paperSentAt,
      alreadyApplied: false,
    } as const;
  });
};

export const resendAdminVoucherEmail = async (
  session: AdminSession,
  voucherId: string,
  expectedAttemptedAt: string | null,
): Promise<
  | {
      success: true;
      voucherId: string;
      alreadyApplied: boolean;
    }
  | AdminVoucherActionFailure
> => {
  if (!isOwner(session) || !uuidPattern.test(voucherId)) {
    return { success: false, reason: "not_found" };
  }

  const [voucher] = await db
    .select({ id: vouchers.id, status: vouchers.status })
    .from(vouchers)
    .where(eq(vouchers.id, voucherId))
    .limit(1);

  if (!voucher) return { success: false, reason: "not_found" };

  if (voucher.status !== "active" && voucher.status !== "redeemed") {
    return { success: false, reason: "invalid_transition" };
  }

  const attemptFingerprint = createHash("sha256")
    .update(expectedAttemptedAt ?? "initial")
    .digest("hex")
    .slice(0, 24);

  try {
    const result = await deliverVoucherEmail(voucher.id, {
      force: true,
      expectedAttemptedAt,
      idempotencyKey: `voucher-email:${voucher.id}:admin:${attemptFingerprint}`,
    });

    return {
      success: true,
      voucherId: voucher.id,
      alreadyApplied: result.staleRequest,
    };
  } catch (error) {
    console.error("Admin voucher email resend failed:", {
      voucherId: voucher.id,
      error,
    });

    return { success: false, reason: "delivery_failed" };
  }
};

export const generateAdminVoucherPdf = async (
  session: AdminSession,
  voucherId: string,
) => {
  if (!isOwner(session) || !uuidPattern.test(voucherId)) return null;

  const [voucher] = await db
    .select({ id: vouchers.id, code: vouchers.code })
    .from(vouchers)
    .where(eq(vouchers.id, voucherId))
    .limit(1);

  if (!voucher) return null;

  return {
    code: voucher.code,
    pdf: await generateVoucherPdf(voucher.id),
  };
};
