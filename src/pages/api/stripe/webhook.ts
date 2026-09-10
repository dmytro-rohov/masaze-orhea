import type { APIContext } from "astro";
import type Stripe from "stripe";

import { stripe } from "../../../server/payments/stripe.service";
import { handlePaidCheckoutSession } from "../../../server/payments/stripe-webhook.service";

export const prerender = false;

const webhookSecret =
  import.meta.env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;

const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

export async function POST({ request }: APIContext) {
  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured.");

    return createJsonResponse(
      {
        success: false,
        error: "STRIPE_WEBHOOK_NOT_CONFIGURED",
      },
      503,
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return createJsonResponse(
      {
        success: false,
        error: "STRIPE_SIGNATURE_MISSING",
      },
      400,
    );
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);

    return createJsonResponse(
      {
        success: false,
        error: "STRIPE_SIGNATURE_INVALID",
      },
      400,
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        await handlePaidCheckoutSession(session);

        break;
      }

      default:
        break;
    }

    return createJsonResponse({
      success: true,
      received: true,
    });
  } catch (error) {
    console.error(
      `Stripe webhook processing failed for event ${event.id}:`,
      error,
    );

    return createJsonResponse(
      {
        success: false,
        error: "STRIPE_WEBHOOK_PROCESSING_FAILED",
      },
      500,
    );
  }
}
