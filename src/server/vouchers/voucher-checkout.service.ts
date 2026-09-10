import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import {
  massageVariants,
  massages,
  payments,
  voucherOrders,
} from "../../db/schema";

import { stripe } from "../payments/stripe.service";

import type { CreateVoucherCheckoutInput } from "./voucher-checkout.validation";

type CreateVoucherCheckoutParams = {
  input: CreateVoucherCheckoutInput;
  origin: string;
};

type CreateVoucherCheckoutResult = {
  checkoutUrl: string;
  voucherOrderId: string;
  checkoutSessionId: string;
};

export const createVoucherCheckout = async ({
  input,
  origin,
}: CreateVoucherCheckoutParams): Promise<CreateVoucherCheckoutResult> => {
  const [variant] = await db
    .select({
      massageId: massages.id,
      massageName: massages.name,
      massageIsActive: massages.isActive,
      voucherAvailable: massages.voucherAvailable,

      variantId: massageVariants.id,
      variantCode: massageVariants.code,
      variantIsActive: massageVariants.isActive,

      durationMinutes: massageVariants.durationMinutes,
      durationLabel: massageVariants.durationLabel,
      priceGrosze: massageVariants.priceGrosze,
    })
    .from(massageVariants)
    .innerJoin(massages, eq(massages.id, massageVariants.massageId))
    .where(
      and(
        eq(massages.id, input.massageId),
        eq(massageVariants.code, input.variantCode),
      ),
    )
    .limit(1);

  if (!variant) {
    throw new Error("VOUCHER_VARIANT_NOT_FOUND");
  }

  if (
    !variant.massageIsActive ||
    !variant.variantIsActive ||
    !variant.voucherAvailable
  ) {
    throw new Error("VOUCHER_VARIANT_UNAVAILABLE");
  }

  if (variant.priceGrosze <= 0) {
    throw new Error("VOUCHER_INVALID_PRICE");
  }

  const [voucherOrder] = await db
    .insert(voucherOrders)
    .values({
      status: "pending_payment",
      voucherType: "service",

      massageId: variant.massageId,
      massageVariantId: variant.variantId,

      massageNameSnapshot: variant.massageName,
      durationMinutesSnapshot: variant.durationMinutes,
      durationLabelSnapshot: variant.durationLabel,
      priceGroszeSnapshot: variant.priceGrosze,

      amountGrosze: variant.priceGrosze,
      currency: "PLN",

      buyerFirstName: input.buyer.firstName,
      buyerLastName: input.buyer.lastName,
      buyerEmail: input.buyer.email,

      recipientName: input.recipient.name,
      message: input.message ?? null,
    })
    .returning({
      id: voucherOrders.id,
    });

  if (!voucherOrder) {
    throw new Error("VOUCHER_ORDER_CREATE_FAILED");
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      customer_email: input.buyer.email,

      line_items: [
        {
          quantity: 1,

          price_data: {
            currency: "pln",

            unit_amount: variant.priceGrosze,

            product_data: {
              name: `Voucher ORHEA — ${variant.massageName}`,

            description:
              variant.durationLabel?.trim() ||
              (variant.durationMinutes
                ? `${variant.durationMinutes} min`
                : undefined),
            },
          },
        },
      ],

      metadata: {
        voucherOrderId: voucherOrder.id,
      },

      success_url: `${origin}/voucher?payment=success`,
      cancel_url: `${origin}/voucher?payment=cancelled`,
    });

    if (!session.url) {
      throw new Error("STRIPE_CHECKOUT_URL_MISSING");
    }

    await db.insert(payments).values({
      voucherOrderId: voucherOrder.id,

      provider: "stripe",
      status: "pending",

      providerCheckoutSessionId: session.id,
      providerPaymentIntentId: null,

      amountGrosze: variant.priceGrosze,
      currency: "PLN",
    });

    return {
      checkoutUrl: session.url,
      voucherOrderId: voucherOrder.id,
      checkoutSessionId: session.id,
    };
  } catch (error) {
    await db
      .update(voucherOrders)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(voucherOrders.id, voucherOrder.id));

    throw error;
  }
};
