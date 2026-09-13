import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { vouchers } from "@/db/schema";
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

    return {
      success: true,
      voucherId: voucher.id,
      status: "redeemed" as const,
      alreadyApplied: false,
    };
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
