import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

import { handlePaidCheckoutSession } from "../src/server/payments/stripe-webhook.service";

const databaseUrl = process.env.DATABASE_URL;

if (
  !databaseUrl ||
  !["localhost", "127.0.0.1", "::1"].includes(
    new URL(databaseUrl).hostname,
  )
) {
  throw new Error(
    "Voucher webhook association smoke test may run only against local PostgreSQL.",
  );
}

// A Stripe Test account can forward signed events created by another local or
// preview environment. An event whose voucher order is absent from this DB is
// intentionally ignored; an existing order without its payment still fails
// loudly in the service and is not hidden by this guard.
const result = await handlePaidCheckoutSession({
  id: `cs_test_${randomUUID().replaceAll("-", "")}`,
  payment_status: "paid",
  metadata: { voucherOrderId: randomUUID() },
} as unknown as Stripe.Checkout.Session);

assert.equal(result.handled, false);

console.log("Voucher webhook association: foreign checkout is ignored safely.");
