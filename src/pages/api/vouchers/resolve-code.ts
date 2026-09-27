import type { APIContext } from "astro";

import { resolveVoucherBookingByCode } from "@/server/vouchers/voucher-reservation.service";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function POST({ request }: APIContext) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return json({ success: false, message: "Nieprawidłowy format danych." }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Nieprawidłowy format danych." }, 400);
  }

  const code = typeof body === "object" && body !== null && "code" in body
    ? (body as { code?: unknown }).code
    : undefined;
  if (typeof code !== "string") {
    return json({ success: false, message: "Nie można rozpoznać vouchera." }, 400);
  }

  try {
    const voucher = await resolveVoucherBookingByCode(code);
    return json({ success: true, voucher });
  } catch (error) {
    if (!(error instanceof Error)) {
      return json({ success: false, message: "Nie udało się sprawdzić vouchera." }, 500);
    }
    if (error.message === "VOUCHER_BOOKING_EXPIRED" || error.message === "VOUCHER_BOOKING_CANCELLED") {
      return json({ success: false, message: "Voucher nie może już zostać wykorzystany." }, 410);
    }
    if (error.message === "VOUCHER_BOOKING_UNAVAILABLE") {
      return json({ success: false, message: "Voucher nie jest dostępny do rezerwacji." }, 409);
    }
    if (error.message === "VOUCHER_BOOKING_NOT_FOUND") {
      return json({ success: false, message: "Nie można rozpoznać vouchera." }, 404);
    }
    console.error("Voucher code resolution failed:", error);
    return json({ success: false, message: "Nie udało się sprawdzić vouchera." }, 500);
  }
}
