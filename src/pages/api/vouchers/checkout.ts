import type { APIContext } from "astro";

import { createVoucherCheckout } from "../../../server/vouchers/voucher-checkout.service";
import { validateVoucherCheckoutInput } from "../../../server/vouchers/voucher-checkout.validation";

export const prerender = false;

const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

export async function POST({ request, url }: APIContext) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return createJsonResponse(
        {
          success: false,
          message: "Nieprawidłowy format danych.",
        },
        400,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return createJsonResponse(
        {
          success: false,
          message: "Nieprawidłowy JSON.",
        },
        400,
      );
    }

    const validation = validateVoucherCheckoutInput(body);

    if (!validation.success) {
      return createJsonResponse(
        {
          success: false,
          message: validation.message,
        },
        400,
      );
    }

    const checkout = await createVoucherCheckout({
      input: validation.data,
      origin: url.origin,
    });

    return createJsonResponse(
      {
        success: true,
        checkoutUrl: checkout.checkoutUrl,
        voucherOrderId: checkout.voucherOrderId,
      },
      201,
    );
  } catch (error) {
    console.error("Voucher checkout API error:", error);

    if (error instanceof Error) {
      switch (error.message) {
        case "VOUCHER_VARIANT_NOT_FOUND":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany wariant vouchera nie istnieje.",
            },
            400,
          );

        case "VOUCHER_VARIANT_UNAVAILABLE":
          return createJsonResponse(
            {
              success: false,
              message: "Wybrany masaż nie jest obecnie dostępny jako voucher.",
            },
            400,
          );

        case "VOUCHER_INVALID_PRICE":
          return createJsonResponse(
            {
              success: false,
              message: "Cena wybranego vouchera jest nieprawidłowa.",
            },
            500,
          );

        case "STRIPE_SECRET_KEY_NOT_CONFIGURED":
          return createJsonResponse(
            {
              success: false,
              message: "Płatności online są chwilowo niedostępne.",
            },
            503,
          );
      }
    }

    return createJsonResponse(
      {
        success: false,
        message: "Nie udało się rozpocząć płatności.",
      },
      500,
    );
  }
}

export async function GET() {
  return createJsonResponse(
    {
      success: false,
      message: "Ta metoda nie jest obsługiwana.",
    },
    405,
  );
}
