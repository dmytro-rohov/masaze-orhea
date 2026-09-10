import Stripe from "stripe";

const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY_NOT_CONFIGURED");
}

export const stripe = new Stripe(stripeSecretKey);