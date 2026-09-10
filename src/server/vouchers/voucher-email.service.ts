import { Buffer } from "node:buffer";

import { and, eq, ne } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "../../db";
import { voucherOrders, vouchers } from "../../db/schema";

import { generateVoucherPdf } from "./voucher-pdf.service";

const VOUCHER_EMAIL_DELIVERY_FAILED = "VOUCHER_EMAIL_DELIVERY_FAILED";
const VOUCHER_EMAIL_NOT_CONFIGURED = "VOUCHER_EMAIL_NOT_CONFIGURED";
const VOUCHER_EMAIL_PDF_GENERATION_FAILED =
  "VOUCHER_EMAIL_PDF_GENERATION_FAILED";
const VOUCHER_EMAIL_PROVIDER_FAILED = "VOUCHER_EMAIL_PROVIDER_FAILED";

type VoucherEmailDeliveryResult = {
  voucherId: string;
  sent: true;
  alreadySent: boolean;
};

type VoucherEmailDeliveryOutcome =
  | VoucherEmailDeliveryResult
  | {
      voucherId: string;
      sent: false;
      errorCode: string;
      cause: unknown;
    };

const getEmailConfig = () => {
  const apiKey =
    import.meta.env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  const from =
    import.meta.env?.VOUCHER_EMAIL_FROM ?? process.env.VOUCHER_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error(VOUCHER_EMAIL_NOT_CONFIGURED);
  }

  return { apiKey, from };
};

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[character] ?? character,
  );

const formatExpiryDate = (date: Date): string =>
  new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(date);

const getVoucherLabel = (
  voucherType: "service" | "amount",
  massageName: string | null,
): string => {
  if (voucherType === "service" && massageName?.trim()) {
    return massageName.trim();
  }

  return "Voucher kwotowy ORHEA";
};

const createVoucherEmailText = (data: {
  buyerFirstName: string;
  recipientName: string;
  voucherLabel: string;
  voucherCode: string;
  expiryDate: string;
}): string =>
  [
    `Dzień dobry, ${data.buyerFirstName}.`,
    "",
    `Twój voucher ORHEA dla ${data.recipientName} jest gotowy.`,
    `Voucher: ${data.voucherLabel}`,
    `Kod: ${data.voucherCode}`,
    `Ważny do: ${data.expiryDate}`,
    "",
    "Voucher w formacie PDF znajdziesz w załączniku tej wiadomości.",
    "",
    "Zespół ORHEA",
  ].join("\n");

const createVoucherEmailHtml = (data: {
  buyerFirstName: string;
  recipientName: string;
  voucherLabel: string;
  voucherCode: string;
  expiryDate: string;
}): string => `
  <div style="font-family: Arial, sans-serif; color: #292b24; line-height: 1.6;">
    <p>Dzień dobry, ${escapeHtml(data.buyerFirstName)}.</p>
    <p>
      Twój voucher ORHEA dla
      <strong>${escapeHtml(data.recipientName)}</strong> jest gotowy.
    </p>
    <p>
      <strong>Voucher:</strong> ${escapeHtml(data.voucherLabel)}<br />
      <strong>Kod:</strong> ${escapeHtml(data.voucherCode)}<br />
      <strong>Ważny do:</strong> ${escapeHtml(data.expiryDate)}
    </p>
    <p>Voucher w formacie PDF znajdziesz w załączniku tej wiadomości.</p>
    <p>Zespół ORHEA</p>
  </div>
`;

const getDeliveryErrorCode = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message === VOUCHER_EMAIL_NOT_CONFIGURED) {
      return VOUCHER_EMAIL_NOT_CONFIGURED;
    }

    if (error.message === VOUCHER_EMAIL_PDF_GENERATION_FAILED) {
      return VOUCHER_EMAIL_PDF_GENERATION_FAILED;
    }
  }

  return VOUCHER_EMAIL_PROVIDER_FAILED;
};

const createAttachmentFilename = (voucherCode: string): string => {
  const safeCode = voucherCode
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/g, "-");

  return `voucher-${safeCode}.pdf`;
};

export const deliverVoucherEmail = async (
  voucherId: string,
): Promise<VoucherEmailDeliveryResult> => {
  const outcome = await db.transaction(
    async (tx): Promise<VoucherEmailDeliveryOutcome> => {
      const [voucher] = await tx
        .select({
          id: vouchers.id,
          code: vouchers.code,
          voucherType: vouchers.voucherType,
          massageName: vouchers.massageNameSnapshot,
          recipientName: vouchers.recipientName,
          expiresAt: vouchers.expiresAt,
          emailDeliveryStatus: vouchers.emailDeliveryStatus,
          buyerFirstName: voucherOrders.buyerFirstName,
          buyerEmail: voucherOrders.buyerEmail,
        })
        .from(vouchers)
        .innerJoin(
          voucherOrders,
          eq(voucherOrders.id, vouchers.voucherOrderId),
        )
        .where(eq(vouchers.id, voucherId))
        .limit(1)
        .for("update");

      if (!voucher) {
        throw new Error("VOUCHER_NOT_FOUND");
      }

      if (voucher.emailDeliveryStatus === "sent") {
        return {
          voucherId: voucher.id,
          sent: true,
          alreadySent: true,
        };
      }

      const attemptedAt = new Date();

      await tx
        .update(vouchers)
        .set({
          emailDeliveryStatus: "pending",
          emailAttemptedAt: attemptedAt,
          emailLastError: null,
          updatedAt: attemptedAt,
        })
        .where(eq(vouchers.id, voucher.id));

      try {
        const { apiKey, from } = getEmailConfig();
        const voucherLabel = getVoucherLabel(
          voucher.voucherType,
          voucher.massageName,
        );
        const expiryDate = formatExpiryDate(voucher.expiresAt);
        let pdf: Uint8Array;

        try {
          pdf = await generateVoucherPdf(voucher.id);
        } catch (error) {
          throw new Error(VOUCHER_EMAIL_PDF_GENERATION_FAILED, {
            cause: error,
          });
        }

        const resend = new Resend(apiKey);
        const emailPayload = {
          from,
          to: voucher.buyerEmail,
          subject: `Twój voucher ORHEA — ${voucherLabel}`,
          text: createVoucherEmailText({
            buyerFirstName: voucher.buyerFirstName,
            recipientName: voucher.recipientName,
            voucherLabel,
            voucherCode: voucher.code,
            expiryDate,
          }),
          html: createVoucherEmailHtml({
            buyerFirstName: voucher.buyerFirstName,
            recipientName: voucher.recipientName,
            voucherLabel,
            voucherCode: voucher.code,
            expiryDate,
          }),
          attachments: [
            {
              filename: createAttachmentFilename(voucher.code),
              content: Buffer.from(pdf),
              contentType: "application/pdf",
            },
          ],
        };

        let emailResponse: Awaited<ReturnType<typeof resend.emails.send>>;

        try {
          emailResponse = await resend.emails.send(emailPayload, {
            idempotencyKey: `voucher-email:${voucher.id}`,
          });
        } catch (error) {
          throw new Error(VOUCHER_EMAIL_PROVIDER_FAILED, {
            cause: error,
          });
        }

        if (emailResponse.error) {
          throw new Error(VOUCHER_EMAIL_PROVIDER_FAILED, {
            cause: emailResponse.error,
          });
        }
      } catch (error) {
        const errorCode = getDeliveryErrorCode(error);
        const failedAt = new Date();

        await tx
          .update(vouchers)
          .set({
            emailDeliveryStatus: "failed",
            emailLastError: errorCode,
            updatedAt: failedAt,
          })
          .where(
            and(
              eq(vouchers.id, voucher.id),
              ne(vouchers.emailDeliveryStatus, "sent"),
            ),
          );

        return {
          voucherId: voucher.id,
          sent: false,
          errorCode,
          cause: error,
        };
      }

      const sentAt = new Date();

      await tx
        .update(vouchers)
        .set({
          emailDeliveryStatus: "sent",
          emailSentAt: sentAt,
          emailLastError: null,
          updatedAt: sentAt,
        })
        .where(eq(vouchers.id, voucher.id));

      return {
        voucherId: voucher.id,
        sent: true,
        alreadySent: false,
      };
    },
  );

  if (!outcome.sent) {
    throw new Error(VOUCHER_EMAIL_DELIVERY_FAILED, {
      cause: outcome.cause,
    });
  }

  return outcome;
};
