import type {
  AdminReportBookingRow,
  AdminReportDto,
  AdminReportVoucherRow,
} from "@/server/admin/admin-reports.service";

import { getGoogleReportsClient } from "./google-reports.client";

const REPORT_TIME_ZONE = "Europe/Warsaw";

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("pl-PL", {
  timeZone: REPORT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  timeZone: REPORT_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const bookingStatusLabels: Record<AdminReportBookingRow["status"], string> = {
  pending: "Oczekuje",
  confirmed: "Potwierdzona",
  cancelled: "Anulowana",
  completed: "Zakończona",
  rejected: "Odrzucona",
  no_show: "Nieobecność",
};

const voucherStatusLabels: Record<
  NonNullable<AdminReportVoucherRow["voucherStatus"]>,
  string
> = {
  active: "Aktywny",
  redeemed: "Zrealizowany",
  expired: "Wygasł",
  cancelled: "Anulowany",
};

const paymentStatusLabels: Record<
  NonNullable<AdminReportVoucherRow["paymentStatus"]>,
  string
> = {
  pending: "Oczekuje",
  paid: "Opłacona",
  failed: "Nieudana",
  cancelled: "Anulowana",
  refunded: "Zwrócona",
};

const orderStatusLabels: Record<AdminReportVoucherRow["orderStatus"], string> = {
  pending_payment: "Oczekuje na płatność",
  paid: "Opłacone",
  failed: "Nieudane",
  cancelled: "Anulowane",
};

const formatReportDate = (date: string): string =>
  date.split("-").reverse().join(".");

const getBookingSheetValues = (
  rows: AdminReportBookingRow[],
): Array<Array<string | number>> => [
  [
    "Data wizyty",
    "Godzina od",
    "Godzina do",
    "Specjalista",
    "Masaż",
    "Wariant",
    "Status",
    "Lokalizacja",
    "Klient",
    "E-mail",
    "Telefon",
    "Cena (PLN)",
    "Utworzono rezerwację",
    "ID rezerwacji",
  ],
  ...rows.map((row) => [
    dateFormatter.format(row.appointmentStartAt),
    timeFormatter.format(row.appointmentStartAt),
    timeFormatter.format(row.appointmentEndAt),
    row.specialistName,
    row.massageName,
    row.variant,
    bookingStatusLabels[row.status],
    row.locationType === "salon" ? "Salon ORHEA" : "Usługa mobilna",
    row.customerName,
    row.customerEmail,
    row.customerPhone ?? "",
    row.priceGrosze / 100,
    dateTimeFormatter.format(row.createdAt),
    row.bookingId,
  ]),
];

const getVoucherSheetValues = (
  rows: AdminReportVoucherRow[],
): Array<Array<string | number>> => [
  [
    "Data zakupu",
    "Kod vouchera",
    "Typ",
    "Masaż",
    "Wariant",
    "Wartość",
    "Waluta",
    "Status zamówienia",
    "Status płatności",
    "Status vouchera",
    "Data realizacji",
    "Odbiorca",
    "Kupujący",
    "E-mail kupującego",
    "ID zamówienia",
  ],
  ...rows.map((row) => [
    dateTimeFormatter.format(row.purchasedAt),
    row.voucherCode ?? "",
    row.voucherType === "service" ? "Usługa" : "Kwotowy",
    row.massageName ?? "Voucher kwotowy",
    row.variant,
    row.amountGrosze / 100,
    row.currency,
    orderStatusLabels[row.orderStatus],
    row.paymentStatus ? paymentStatusLabels[row.paymentStatus] : "Brak",
    row.voucherStatus ? voucherStatusLabels[row.voucherStatus] : "Brak",
    row.redeemedAt ? dateTimeFormatter.format(row.redeemedAt) : "",
    row.recipientName,
    row.buyerName,
    row.buyerEmail,
    row.orderId,
  ]),
];

const getSummarySheetValues = (
  report: AdminReportDto,
): Array<Array<string | number>> => {
  if (!report.summary) return [];

  return [
    ["Podsumowanie raportu ORHEA", "Wartość"],
    ["Zakres od", formatReportDate(report.dateRange.from)],
    ["Zakres do", formatReportDate(report.dateRange.to)],
    ["Wygenerowano", dateTimeFormatter.format(report.generatedAt)],
    ["Wszystkie rezerwacje", report.summary.bookingsTotal],
    ["Oczekujące", report.summary.bookingsByStatus.pending],
    ["Potwierdzone", report.summary.bookingsByStatus.confirmed],
    ["Zakończone", report.summary.bookingsByStatus.completed],
    ["Anulowane", report.summary.bookingsByStatus.cancelled],
    ["Odrzucone", report.summary.bookingsByStatus.rejected],
    ["Nieobecności", report.summary.bookingsByStatus.no_show],
    ["Rezerwacje Adriana", report.summary.bookingsBySpecialist.adrian],
    ["Rezerwacje Aleksandry", report.summary.bookingsBySpecialist.aleksandra],
    ["Sprzedane vouchery", report.summary.soldVouchers],
    ["Wykorzystane vouchery", report.summary.redeemedVouchers],
    [
      "Łączna wartość sprzedanych voucherów (PLN)",
      report.summary.soldVoucherValueGrosze / 100,
    ],
  ];
};

export const buildGoogleSheetsReportDocument = (report: AdminReportDto) => {
  if (report.scope.type === "specialist") {
    const sheetName =
      report.scope.specialistId === "adrian" ? "Adrian" : "Aleksandra";

    return {
      title: getReportTitle(report),
      sheets: [
        {
          title: sheetName,
          values: getBookingSheetValues(
            report.bookings[report.scope.specialistId],
          ),
        },
      ],
    };
  }

  return {
    title: getReportTitle(report),
    sheets: [
      { title: "Podsumowanie", values: getSummarySheetValues(report) },
      {
        title: "Adrian",
        values: getBookingSheetValues(report.bookings.adrian),
      },
      {
        title: "Aleksandra",
        values: getBookingSheetValues(report.bookings.aleksandra),
      },
      {
        title: "Vouchery",
        values: getVoucherSheetValues(report.vouchers ?? []),
      },
    ],
  };
};

const getReportTitle = (report: AdminReportDto): string => {
  const range = `${formatReportDate(report.dateRange.from)}–${formatReportDate(
    report.dateRange.to,
  )}`;

  if (report.scope.type === "owner") {
    return `ORHEA — Raport ${range}`;
  }

  const specialistName =
    report.scope.specialistId === "adrian" ? "Adrian" : "Aleksandra";

  return `ORHEA — ${specialistName} — Raport ${range}`;
};

export type GoogleSheetsReportResult = {
  spreadsheetId: string;
  title: string;
  url: string;
};

export const exportAdminReportToGoogleSheets = async (
  report: AdminReportDto,
): Promise<GoogleSheetsReportResult> => {
  const { drive, sheets, folderId } = await getGoogleReportsClient();
  const document = buildGoogleSheetsReportDocument(report);
  const { title } = document;
  const reportSheets = document.sheets;

  try {
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: reportSheets.map((sheet) => ({
          properties: {
            title: sheet.title,
            gridProperties: { frozenRowCount: 1 },
          },
        })),
      },
      fields: "spreadsheetId",
    });
    const spreadsheetId = created.data.spreadsheetId;

    if (!spreadsheetId) {
      throw new Error("GOOGLE_REPORTS_CREATE_FAILED");
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: reportSheets.map((sheet) => ({
          range: `'${sheet.title}'!A1`,
          majorDimension: "ROWS",
          values: sheet.values,
        })),
      },
    });

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: (spreadsheet.data.sheets ?? []).flatMap((sheet) => {
          const sheetId = sheet.properties?.sheetId;

          if (sheetId === undefined || sheetId === null) return [];

          return [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.36,
                      green: 0.39,
                      blue: 0.27,
                    },
                    textFormat: {
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                      bold: true,
                    },
                  },
                },
                fields: "userEnteredFormat(backgroundColor,textFormat)",
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId,
                  dimension: "COLUMNS",
                  startIndex: 0,
                },
              },
            },
          ];
        }),
      },
    });

    if (folderId) {
      const file = await drive.files.get({
        fileId: spreadsheetId,
        fields: "parents",
      });

      await drive.files.update({
        fileId: spreadsheetId,
        addParents: folderId,
        removeParents: file.data.parents?.join(","),
        fields: "id,parents",
      });
    }

    const file = await drive.files.get({
      fileId: spreadsheetId,
      fields: "webViewLink",
    });

    return {
      spreadsheetId,
      title,
      url:
        file.data.webViewLink ??
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("GOOGLE_REPORTS_")
    ) {
      throw error;
    }

    throw new Error("GOOGLE_REPORTS_EXPORT_FAILED");
  }
};
