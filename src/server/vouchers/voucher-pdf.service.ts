import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";

import { db } from "../../db";
import {
  massages,
  voucherOrderAddons,
  vouchers,
} from "../../db/schema";

import { getVoucherBookingUrl } from "./voucher-issuance.service";

const PDF_WIDTH = 841.89;
const PDF_HEIGHT = 595.28;
const LIGHT_TEXT_COLOR = rgb(80 / 255, 87 / 255, 62 / 255);
const VIP_TEXT_COLOR = rgb(199 / 255, 160 / 255, 89 / 255);

const VOUCHER_FIELD_X = 61;
const VOUCHER_FIELD_WIDTH = 382;
const VOUCHER_FIELD_Y = {
  // Values sit consistently below the template headings and above their rules.
  code: 479,
  recipient: 399,
  service: 317,
  addons: 239,
  wishes: 182,
  expiry: 76,
} as const;
const VOUCHER_QR = {
  x: 610,
  y: 74,
  size: 146,
  captionY: 55,
} as const;

const voucherAssetPath = (...segments: string[]): string =>
  path.resolve(process.cwd(), "public", "vouchers", ...segments);

const lightTemplatePath = voucherAssetPath("voucher-light.png");

const darkTemplatePath = voucherAssetPath("voucher-dark.png");

const lexendMediumPath = voucherAssetPath("fonts", "Lexend-Medium.ttf");

const cormorantBoldPath = voucherAssetPath(
  "fonts",
  "CormorantGaramond-Bold.ttf",
);

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(date);

const getDurationText = (
  durationMinutes: number | null,
  durationLabel: string | null,
): string | null => {
  if (durationLabel?.trim()) {
    return durationLabel.trim();
  }

  if (durationMinutes) {
    return `${durationMinutes} min`;
  }

  return null;
};

const fitSingleLineFontSize = ({
  text,
  font,
  maxWidth,
  preferredSize,
  minimumSize,
}: {
  text: string;
  font: PDFFont;
  maxWidth: number;
  preferredSize: number;
  minimumSize: number;
}): number => {
  let size = preferredSize;

  while (size > minimumSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }

  return size;
};

const wrapText = ({
  text,
  font,
  size,
  maxWidth,
  maxLines,
}: {
  text: string;
  font: PDFFont;
  size: number;
  maxWidth: number;
  maxLines: number;
}): string[] => {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];

  for (const word of words) {
    const currentLine = lines.at(-1);

    if (!currentLine) {
      lines.push(word);
      continue;
    }

    const candidate = `${currentLine} ${word}`;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      lines[lines.length - 1] = candidate;
      continue;
    }

    if (lines.length === maxLines) {
      lines[lines.length - 1] = candidate;
      continue;
    }

    lines.push(word);
  }

  return lines;
};

const truncateToWidth = ({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string;
  font: PDFFont;
  size: number;
  maxWidth: number;
}): string => {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  let truncated = text;

  while (
    truncated.length > 1 &&
    font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth
  ) {
    truncated = truncated.slice(0, -1).trimEnd();
  }

  return `${truncated}…`;
};

const getWrappedTextLayout = ({
  text,
  font,
  maxWidth,
  preferredSize,
  minimumSize,
  maxLines,
}: {
  text: string;
  font: PDFFont;
  maxWidth: number;
  preferredSize: number;
  minimumSize: number;
  maxLines: number;
}): { lines: string[]; size: number } => {
  let size = preferredSize;
  let lines = wrapText({
    text,
    font,
    size,
    maxWidth,
    maxLines,
  });

  while (
    size > minimumSize &&
    lines.some((line) => font.widthOfTextAtSize(line, size) > maxWidth)
  ) {
    size -= 0.5;

    lines = wrapText({
      text,
      font,
      size,
      maxWidth,
      maxLines,
    });
  }

  return {
    lines: lines.map((line) =>
      truncateToWidth({
        text: line,
        font,
        size,
        maxWidth,
      }),
    ),
    size,
  };
};

export type VoucherPdfData = {
  code: string;
  voucherType: "service" | "amount";
  isVip: boolean;
  massageName: string | null;
  durationMinutes: number | null;
  durationLabel: string | null;
  amountGrosze: number;
  currency: string;
  recipientName: string | null;
  message: string | null;
  issuedAt: Date;
  expiresAt: Date;
  addonNames: string[];
  bookingUrl: string | null;
};

export const getVoucherPdfData = async (
  voucherId: string,
): Promise<VoucherPdfData> => {
  const [[voucher], bookingUrl] = await Promise.all([
    db
      .select({
        code: vouchers.code,
        voucherType: vouchers.voucherType,
        zoneId: massages.zoneId,
        massageName: vouchers.massageNameSnapshot,
        durationMinutes: vouchers.durationMinutesSnapshot,
        durationLabel: vouchers.durationLabelSnapshot,
        amountGrosze: vouchers.amountGrosze,
        currency: vouchers.currency,
        recipientName: vouchers.recipientName,
        message: vouchers.message,
        issuedAt: vouchers.issuedAt,
        expiresAt: vouchers.expiresAt,
      })
      .from(vouchers)
      .leftJoin(massages, eq(massages.id, vouchers.massageId))
      .where(eq(vouchers.id, voucherId))
      .limit(1),
    getVoucherBookingUrl(voucherId),
  ]);

  if (!voucher) {
    throw new Error("VOUCHER_NOT_FOUND");
  }

  const addons = await db
    .select({ name: voucherOrderAddons.nameSnapshot })
    .from(voucherOrderAddons)
    .innerJoin(
      vouchers,
      eq(vouchers.voucherOrderId, voucherOrderAddons.voucherOrderId),
    )
    .where(eq(vouchers.id, voucherId))
    .orderBy(voucherOrderAddons.createdAt, voucherOrderAddons.addonId);

  return {
    ...voucher,
    isVip: voucher.zoneId === "vip",
    addonNames: addons.map((addon) => addon.name),
    bookingUrl,
  };
};

export const renderVoucherPdf = async (
  data: VoucherPdfData,
): Promise<Uint8Array> => {
  const templatePath = data.isVip ? darkTemplatePath : lightTemplatePath;
  const textColor = data.isVip ? VIP_TEXT_COLOR : LIGHT_TEXT_COLOR;
  const qrCaptionColor = data.isVip ? VIP_TEXT_COLOR : LIGHT_TEXT_COLOR;

  const [templateBytes, lexendMediumBytes, cormorantBoldBytes] =
    await Promise.all([
      readFile(templatePath),
      readFile(lexendMediumPath),
      readFile(cormorantBoldPath),
    ]);

  const pdfDocument = await PDFDocument.create();

  pdfDocument.registerFontkit(fontkit);
  pdfDocument.setCreationDate(data.issuedAt);
  pdfDocument.setModificationDate(data.issuedAt);
  pdfDocument.setCreator("ORHEA");
  pdfDocument.setProducer("ORHEA voucher service");
  pdfDocument.setTitle(`Voucher ORHEA ${data.code}`);

  const [templateImage, lexendMedium, cormorantBold] = await Promise.all([
    pdfDocument.embedPng(templateBytes),
    pdfDocument.embedFont(lexendMediumBytes),
    pdfDocument.embedFont(cormorantBoldBytes),
  ]);

  const page = pdfDocument.addPage([PDF_WIDTH, PDF_HEIGHT]);

  page.drawImage(templateImage, {
    x: 0,
    y: 0,
    width: PDF_WIDTH,
    height: PDF_HEIGHT,
  });

  const codeSize = fitSingleLineFontSize({
    text: data.code,
    font: lexendMedium,
    maxWidth: VOUCHER_FIELD_WIDTH,
    preferredSize: 14,
    minimumSize: 10,
  });

  page.drawText(data.code, {
    x: VOUCHER_FIELD_X,
    y: VOUCHER_FIELD_Y.code,
    size: codeSize,
    font: lexendMedium,
    color: textColor,
  });

  const recipientName = data.recipientName?.trim();

  if (recipientName) {
    const recipient = getWrappedTextLayout({
      text: recipientName,
      font: cormorantBold,
      maxWidth: VOUCHER_FIELD_WIDTH,
      preferredSize: 28,
      minimumSize: 16,
      maxLines: 1,
    });

    recipient.lines.forEach((line, index) => {
      page.drawText(line, {
        x: VOUCHER_FIELD_X,
        y: VOUCHER_FIELD_Y.recipient - index * recipient.size,
        size: recipient.size,
        font: cormorantBold,
        color: textColor,
      });
    });
  }

  const serviceName =
    data.voucherType === "service" && data.massageName?.trim()
      ? data.massageName.trim()
      : "Voucher kwotowy ORHEA";

  const duration = getDurationText(data.durationMinutes, data.durationLabel);

  const serviceText = duration ? `${serviceName} · ${duration}` : serviceName;

  const service = getWrappedTextLayout({
    text: serviceText,
    font: cormorantBold,
    maxWidth: VOUCHER_FIELD_WIDTH,
    preferredSize: 20,
    minimumSize: 12,
    maxLines: 1,
  });

  service.lines.forEach((line, index) => {
    page.drawText(line, {
      x: VOUCHER_FIELD_X,
      y: VOUCHER_FIELD_Y.service - index * service.size,
      size: service.size,
      font: cormorantBold,
      color: textColor,
    });
  });

  if (data.addonNames.length > 0) {
    const addons = getWrappedTextLayout({
      text: data.addonNames.join(" · "),
      font: cormorantBold,
      maxWidth: VOUCHER_FIELD_WIDTH,
      preferredSize: 15,
      minimumSize: 9,
      maxLines: 2,
    });
    const addonsLineHeight = addons.size * 1.08;

    addons.lines.forEach((line, index) => {
      page.drawText(line, {
        x: VOUCHER_FIELD_X,
        y: VOUCHER_FIELD_Y.addons - index * addonsLineHeight,
        size: addons.size,
        font: cormorantBold,
        color: textColor,
      });
    });
  }

  const message = data.message?.trim();

  if (message) {
    const wishes = getWrappedTextLayout({
      text: message,
      font: lexendMedium,
      maxWidth: VOUCHER_FIELD_WIDTH,
      preferredSize: 12,
      minimumSize: 8,
      maxLines: 3,
    });

    const wishesLineHeight = wishes.size * 1.18;

    wishes.lines.forEach((line, index) => {
      page.drawText(line, {
        x: VOUCHER_FIELD_X,
        y: VOUCHER_FIELD_Y.wishes - index * wishesLineHeight,
        size: wishes.size,
        font: lexendMedium,
        color: textColor,
      });
    });
  }

  page.drawText(formatDate(data.expiresAt), {
    x: VOUCHER_FIELD_X,
    y: VOUCHER_FIELD_Y.expiry,
    size: 14,
    font: lexendMedium,
    color: textColor,
  });

  if (data.bookingUrl) {
    const qrDataUrl = await QRCode.toDataURL(data.bookingUrl, {
      errorCorrectionLevel: "M",
      margin: 3,
      width: 512,
      color: {
        dark: "#111111",
        light: "#FFFFFFFF",
      },
    });
    const encodedQr = qrDataUrl.slice(qrDataUrl.indexOf(",") + 1);
    const qrImage = await pdfDocument.embedPng(Buffer.from(encodedQr, "base64"));

    page.drawRectangle({
      x: VOUCHER_QR.x - 4,
      y: VOUCHER_QR.y - 4,
      width: VOUCHER_QR.size + 8,
      height: VOUCHER_QR.size + 8,
      color: rgb(1, 1, 1),
    });
    page.drawImage(qrImage, {
      x: VOUCHER_QR.x,
      y: VOUCHER_QR.y,
      width: VOUCHER_QR.size,
      height: VOUCHER_QR.size,
    });

    const caption = "Zeskanuj, aby zarezerwować termin";
    const captionSize = fitSingleLineFontSize({
      text: caption,
      font: lexendMedium,
      maxWidth: VOUCHER_QR.size + 10,
      preferredSize: 8,
      minimumSize: 6,
    });
    const captionWidth = lexendMedium.widthOfTextAtSize(caption, captionSize);

    page.drawText(caption, {
      x: VOUCHER_QR.x + (VOUCHER_QR.size - captionWidth) / 2,
      y: VOUCHER_QR.captionY,
      size: captionSize,
      font: lexendMedium,
      color: qrCaptionColor,
    });
  }

  return pdfDocument.save();
};

export const generateVoucherPdf = async (
  voucherId: string,
): Promise<Uint8Array> => {
  const data = await getVoucherPdfData(voucherId);

  return renderVoucherPdf(data);
};
