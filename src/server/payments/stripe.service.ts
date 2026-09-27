import Stripe from "stripe";

// Stripe credentials are runtime-only secrets. Reading process.env keeps them
// out of the Docker build output and allows one image per environment.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY_NOT_CONFIGURED");
}

export const stripe = new Stripe(stripeSecretKey);
