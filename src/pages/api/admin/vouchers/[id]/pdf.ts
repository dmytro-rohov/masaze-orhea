import { Buffer } from "node:buffer";

import type { APIContext } from "astro";

import { isOwner } from "@/server/admin/admin-authorization.service";
import { generateAdminVoucherPdf } from "@/server/admin/admin-voucher-actions.service";

export const prerender = false;

const safeFilename = (code: string) =>
  `voucher-orhea-${code.toLowerCase().replaceAll(/[^a-z0-9-]/g, "-")}.pdf`;

export async function GET({ params, locals }: APIContext) {
  if (!locals.admin) {
    return new Response("Wymagane jest zalogowanie.", { status: 401 });
  }

  if (!isOwner(locals.admin)) {
    return new Response("Brak dostępu.", { status: 403 });
  }

  try {
    const result = await generateAdminVoucherPdf(locals.admin, params.id ?? "");

    if (!result) {
      return new Response("Nie znaleziono vouchera.", { status: 404 });
    }

    return new Response(Buffer.from(result.pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(result.code)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Admin voucher PDF generation failed:", { voucherId: params.id, error });
    return new Response("Nie udało się wygenerować PDF.", { status: 500 });
  }
}
