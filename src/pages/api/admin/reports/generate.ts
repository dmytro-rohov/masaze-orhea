import type { APIContext } from "astro";

import { getAdminReport } from "@/server/admin/admin-reports.service";
import { isSameOriginAdminRequest } from "@/server/admin/admin-auth.service";
import { exportAdminReportToGoogleSheets } from "@/server/reports/google-sheets-report.service";

export const prerender = false;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST({ request, locals }: APIContext) {
  if (!locals.admin) {
    return jsonResponse(
      {
        success: false,
        message: "Wymagane jest zalogowanie do panelu administracyjnego.",
      },
      401,
    );
  }

  if (!isSameOriginAdminRequest(request)) {
    return jsonResponse(
      { success: false, message: "Nieprawidłowe źródło żądania." },
      403,
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return jsonResponse(
      { success: false, message: "Nieprawidłowy format danych." },
      400,
    );
  }

  const formData = await request.formData();
  const dateFrom = formData.get("dateFrom");
  const dateTo = formData.get("dateTo");

  if (typeof dateFrom !== "string" || typeof dateTo !== "string") {
    return jsonResponse(
      { success: false, message: "Wybierz prawidłowy zakres dat." },
      400,
    );
  }

  try {
    const report = await getAdminReport(locals.admin, dateFrom, dateTo);
    const exported = await exportAdminReportToGoogleSheets(report);

    return jsonResponse(
      {
        success: true,
        spreadsheetId: exported.spreadsheetId,
        title: exported.title,
        url: exported.url,
      },
      200,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "ADMIN_REPORT_DATE_INVALID") {
      return jsonResponse(
        { success: false, message: "Wybierz prawidłowe daty raportu." },
        400,
      );
    }

    if (code === "ADMIN_REPORT_DATE_RANGE_INVALID") {
      return jsonResponse(
        {
          success: false,
          message: "Data początkowa nie może być późniejsza niż końcowa.",
        },
        400,
      );
    }

    if (code === "ADMIN_REPORT_DATE_RANGE_TOO_LONG") {
      return jsonResponse(
        {
          success: false,
          message: "Jednorazowy raport może obejmować maksymalnie 366 dni.",
        },
        400,
      );
    }

    if (
      code === "GOOGLE_REPORTS_NOT_CONFIGURED" ||
      code === "GOOGLE_REPORTS_AUTH_FAILED" ||
      code === "GOOGLE_REPORTS_ACCOUNT_MISMATCH" ||
      code === "GOOGLE_REPORTS_ALEKSANDRA_EMAIL_NOT_CONFIGURED"
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            code === "GOOGLE_REPORTS_ALEKSANDRA_EMAIL_NOT_CONFIGURED"
              ? "Nie skonfigurowano adresu Google Aleksandry do udostępniania raportów."
              : "Eksport raportów nie jest jeszcze skonfigurowany. Sprawdź konfigurację konta Google.",
        },
        503,
      );
    }

    if (
      code === "GOOGLE_REPORTS_CREATE_FAILED" ||
      code === "GOOGLE_REPORTS_EXPORT_FAILED"
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Nie udało się utworzyć raportu w Google Sheets. Spróbuj ponownie później.",
        },
        502,
      );
    }

    console.error("Admin report generation failed:", error);

    return jsonResponse(
      { success: false, message: "Nie udało się przygotować raportu." },
      500,
    );
  }
}

export function GET() {
  return jsonResponse(
    { success: false, message: "Ta metoda nie jest obsługiwana." },
    405,
  );
}
