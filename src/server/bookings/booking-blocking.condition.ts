import { sql } from "drizzle-orm";

import { bookings } from "@/db/schema";

// Expired online holds remain in PostgreSQL for audit, but do not occupy slots.
// A paid booking clears paymentExpiresAt only after the webhook safely finalizes it.
export const bookingBlocksAvailability = sql<boolean>`
  (
    ${bookings.status} = 'confirmed'
    OR (
      ${bookings.status} = 'pending'
      AND (
        ${bookings.paymentMethod} = 'on_site'
        OR (
          ${bookings.paymentMethod} = 'online'
          AND (
            (${bookings.paymentStatus} = 'pending' AND ${bookings.paymentExpiresAt} > now())
            OR (${bookings.paymentStatus} = 'paid' AND ${bookings.paymentExpiresAt} IS NULL)
          )
        )
      )
    )
  )
`;
