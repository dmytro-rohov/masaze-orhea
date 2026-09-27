import type { APIContext } from "astro";

import { getAvailableAddonsForMassage } from "@/server/bookings/booking-addons.service";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function GET({ request }: APIContext) {
  const massageId = new URL(request.url).searchParams.get("massageId")?.trim();

  if (!massageId || massageId.length > 100) {
    return json({ success: false, message: "Podaj poprawny masaż." }, 400);
  }

  try {
    const addons = await getAvailableAddonsForMassage(massageId, "voucher");
    return json({ success: true, addons });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "VOUCHER_ADDON_MASSAGE_NOT_FOUND"
    ) {
      return json(
        { success: false, message: "Masaż nie jest dostępny jako voucher." },
        404,
      );
    }

    console.error("Voucher addons API error:", error);
    return json(
      { success: false, message: "Nie udało się pobrać dodatków." },
      500,
    );
  }
}
