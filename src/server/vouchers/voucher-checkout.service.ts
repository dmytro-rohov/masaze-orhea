import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import {
  massageVariants,
  massages,
  payments,
  voucherOrderAddons,
  voucherOrders,
} from "../../db/schema";

import { stripe } from "../payments/stripe.service";
import { voucherCheckoutConfig } from "../../data/vouchers";
import { resolveVoucherAddons } from "../bookings/booking-addons.service";

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
  const checkout = await db.transaction(async (tx) => {
    const [variant] = await tx
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

    const selectedAddons = await resolveVoucherAddons({
      massageId: variant.massageId,
      addonIds: input.addonIds,
      executor: tx,
    });

    const paperSurchargeGrosze =
      input.deliveryType === "paper"
        ? voucherCheckoutConfig.paperVoucherSurchargePLN * 100
        : 0;
    const deliveryFeeGrosze = 0;
    const totalAmountGrosze =
      variant.priceGrosze +
      selectedAddons.totalPriceGrosze +
      paperSurchargeGrosze +
      deliveryFeeGrosze;
    const shippingAddress = input.deliveryType === "paper"
      ? input.shippingAddress
      : undefined;

    if (input.deliveryType === "paper" && !shippingAddress) {
      throw new Error("VOUCHER_SHIPPING_ADDRESS_REQUIRED");
    }

    const [voucherOrder] = await tx
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
        deliveryType: input.deliveryType,
        paperSurchargeGrosze,
        deliveryFeeGrosze,
        addonsTotalGrosze: selectedAddons.totalPriceGrosze,
        totalAmountGrosze,
        currency: "PLN",

        buyerFirstName: input.buyer.firstName,
        buyerLastName: input.buyer.lastName,
        buyerEmail: input.buyer.email,

        recipientName: input.recipient.name ?? null,
        shippingStreet: shippingAddress?.street ?? null,
        shippingBuildingNumber: shippingAddress?.buildingNumber ?? null,
        shippingApartmentNumber: shippingAddress?.apartmentNumber ?? null,
        shippingPostalCode: shippingAddress?.postalCode ?? null,
        shippingCity: shippingAddress?.city ?? null,
        message: input.message ?? null,
      })
      .returning({ id: voucherOrders.id });

    if (!voucherOrder) {
      throw new Error("VOUCHER_ORDER_CREATE_FAILED");
    }

    if (selectedAddons.addons.length > 0) {
      await tx.insert(voucherOrderAddons).values(
        selectedAddons.addons.map((addon) => ({
          voucherOrderId: voucherOrder.id,
          addonId: addon.id,
          nameSnapshot: addon.name,
          descriptionSnapshot: addon.description,
          priceGroszeSnapshot: addon.priceGrosze,
          treatmentDurationMinutesSnapshot: addon.treatmentDurationMinutes,
          slotExtensionMinutesSnapshot: addon.slotExtensionMinutes,
        })),
      );
    }

    return {
      voucherOrder,
      variant,
      selectedAddons,
      totalAmountGrosze,
    };
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      customer_email: input.buyer.email,

      line_items: [
        {
          quantity: 1,

          price_data: {
            currency: "pln",

            unit_amount: checkout.totalAmountGrosze,

            product_data: {
              name: `Voucher ORHEA — ${checkout.variant.massageName}`,

              description:
              [
                checkout.variant.durationLabel?.trim() ||
                  (checkout.variant.durationMinutes
                    ? `${checkout.variant.durationMinutes} min`
                    : undefined),
                checkout.selectedAddons.addons.length > 0
                  ? `dodatki: ${checkout.selectedAddons.addons.map((addon) => addon.name).join(", ")}`
                  : undefined,
                input.deliveryType === "paper"
                  ? `voucher papierowy (+${voucherCheckoutConfig.paperVoucherSurchargePLN} zł) · dostawa bezpłatna`
                  : "voucher elektroniczny PDF",
              ]
                .filter(Boolean)
                .join(" · "),
            },
          },
        },
      ],

      metadata: {
        voucherOrderId: checkout.voucherOrder.id,
      },

      success_url: `${origin}/voucher?payment=success`,
      cancel_url: `${origin}/voucher?payment=cancel`,
    });

    if (!session.url) {
      throw new Error("STRIPE_CHECKOUT_URL_MISSING");
    }

    await db.insert(payments).values({
      voucherOrderId: checkout.voucherOrder.id,

      provider: "stripe",
      status: "pending",

      providerCheckoutSessionId: session.id,
      providerPaymentIntentId: null,

      amountGrosze: checkout.totalAmountGrosze,
      currency: "PLN",
    });

    return {
      checkoutUrl: session.url,
      voucherOrderId: checkout.voucherOrder.id,
      checkoutSessionId: session.id,
    };
  } catch (error) {
    await db
      .update(voucherOrders)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(voucherOrders.id, checkout.voucherOrder.id));

    throw error;
  }
};
