import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import fontkit from "@pdf-lib/fontkit";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

import { db } from "../../db";
import { voucherOrders, vouchers } from "../../db/schema";

const PDF_WIDTH = 841.89;
const PDF_HEIGHT = 595.28;
const TEXT_COLOR = rgb(80 / 255, 87 / 255, 62 / 255);

const templatePath = fileURLToPath(
  new URL("../../assets/img/voucher-template-light.png", import.meta.url),
);

const lexendMediumPath = fileURLToPath(
  new URL("../../assets/fonts/pdf/Lexend-Medium.ttf", import.meta.url),
);

const cormorantBoldPath = fileURLToPath(
  new URL("../../assets/fonts/pdf/CormorantGaramond-Bold.ttf", import.meta.url),
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
  let lines = wrapText({ text, font, size, maxWidth, maxLines });

  while (
    size > minimumSize &&
    lines.some((line) => font.widthOfTextAtSize(line, size) > maxWidth)
  ) {
    size -= 0.5;
    lines = wrapText({ text, font, size, maxWidth, maxLines });
  }

  return {
    lines: lines.map((line) =>
      truncateToWidth({ text: line, font, size, maxWidth }),
    ),
    size,
  };
};

export type VoucherPdfData = {
  code: string;
  voucherType: "service" | "amount";
  massageName: string | null;
  durationMinutes: number | null;
  durationLabel: string | null;
  amountGrosze: number;
  currency: string;
  recipientName: string;
  issuedAt: Date;
  expiresAt: Date;
};

export const getVoucherPdfData = async (
  voucherId: string,
): Promise<VoucherPdfData> => {
  const [voucher] = await db
    .select({
      code: vouchers.code,
      voucherType: vouchers.voucherType,
      massageName: vouchers.massageNameSnapshot,
      durationMinutes: vouchers.durationMinutesSnapshot,
      durationLabel: vouchers.durationLabelSnapshot,
      amountGrosze: vouchers.amountGrosze,
      currency: vouchers.currency,
      recipientName: vouchers.recipientName,
      issuedAt: vouchers.issuedAt,
      expiresAt: vouchers.expiresAt,
    })
    .from(vouchers)
    .innerJoin(voucherOrders, eq(voucherOrders.id, vouchers.voucherOrderId))
    .where(eq(vouchers.id, voucherId))
    .limit(1);

  if (!voucher) {
    throw new Error("VOUCHER_NOT_FOUND");
  }

  return voucher;
};

export const renderVoucherPdf = async (
  data: VoucherPdfData,
): Promise<Uint8Array> => {
  const [
    templateBytes,
    lexendMediumBytes,
    cormorantBoldBytes,
  ] = await Promise.all([
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

  const recipient = getWrappedTextLayout({
    text: data.recipientName,
    font: cormorantBold,
    maxWidth: 560,
    preferredSize: 32,
    minimumSize: 16,
    maxLines: 2,
  });
  const recipientLineHeight = recipient.size * 1.05;
  const recipientStartY =
    350 + ((recipient.lines.length - 1) * recipientLineHeight) / 2;

  recipient.lines.forEach((line, index) => {
    const lineWidth = cormorantBold.widthOfTextAtSize(line, recipient.size);

    page.drawText(line, {
      x: (PDF_WIDTH - lineWidth) / 2,
      y: recipientStartY - index * recipientLineHeight,
      size: recipient.size,
      font: cormorantBold,
      color: TEXT_COLOR,
    });
  });

  const serviceName =
    data.voucherType === "service" && data.massageName?.trim()
      ? data.massageName.trim()
      : "Voucher kwotowy ORHEA";
  const duration = getDurationText(
    data.durationMinutes,
    data.durationLabel,
  );
  const serviceText = duration
    ? `${serviceName} · ${duration}`
    : serviceName;
  let service = getWrappedTextLayout({
    text: serviceText,
    font: cormorantBold,
    maxWidth: 610,
    preferredSize: 19,
    minimumSize: 12,
    maxLines: 2,
  });

  if (service.lines.length > 1) {
    service = getWrappedTextLayout({
      text: serviceText,
      font: cormorantBold,
      maxWidth: 610,
      preferredSize: 15,
      minimumSize: 12,
      maxLines: 2,
    });
  }

  const serviceLineHeight = service.size * 1.05;

  service.lines.forEach((line, index) => {
    page.drawText(line, {
      x: 116,
      y: 245 - index * serviceLineHeight,
      size: service.size,
      font: cormorantBold,
      color: TEXT_COLOR,
    });
  });

  const codeSize = fitSingleLineFontSize({
    text: data.code,
    font: lexendMedium,
    maxWidth: 230,
    preferredSize: 11,
    minimumSize: 8,
  });

  page.drawText(data.code, {
    x: 155,
    y: 156,
    size: codeSize,
    font: lexendMedium,
    color: TEXT_COLOR,
  });

  page.drawText(formatDate(data.expiresAt), {
    x: 495,
    y: 156,
    size: 11,
    font: lexendMedium,
    color: TEXT_COLOR,
  });

  return pdfDocument.save();
};

export const generateVoucherPdf = async (
  voucherId: string,
): Promise<Uint8Array> => {
  const data = await getVoucherPdfData(voucherId);

  return renderVoucherPdf(data);
};
