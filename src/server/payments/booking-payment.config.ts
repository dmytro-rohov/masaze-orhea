// Stripe Checkout requires an expiry at least 30 minutes after creation.
// Keep one hold duration for both PostgreSQL and the Checkout Session.
export const BOOKING_PAYMENT_HOLD_MINUTES = 45;
