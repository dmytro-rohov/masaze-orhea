import { eq } from "drizzle-orm";

import { db } from "@/db";
import { bookingEvents, bookings } from "@/db/schema";
import type { AdminSession } from "./admin-auth.service";
import { isOwner } from "./admin-authorization.service";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const markAdminBookingOnSitePaid = async (session: AdminSession, bookingId: string) => {
  if (!isOwner(session)) return { success: false, reason: "forbidden" } as const;
  if (!uuidPattern.test(bookingId)) return { success: false, reason: "not_found" } as const;

  return db.transaction(async (tx) => {
    const [booking] = await tx.select({
      id: bookings.id,
      status: bookings.status,
      paymentMethod: bookings.paymentMethod,
      paymentStatus: bookings.paymentStatus,
      paymentPaidAt: bookings.paymentPaidAt,
    }).from(bookings).where(eq(bookings.id, bookingId)).for("update").limit(1);

    if (!booking) return { success: false, reason: "not_found" } as const;
    if (booking.paymentMethod !== "on_site") {
      return { success: false, reason: "invalid_transition" } as const;
    }
    if (booking.paymentStatus === "paid") {
      return {
        success: true,
        bookingId: booking.id,
        paidAt: booking.paymentPaidAt,
        alreadyApplied: true,
      } as const;
    }
    if (booking.paymentStatus !== "unpaid" || ["cancelled", "rejected"].includes(booking.status)) {
      return { success: false, reason: "invalid_transition" } as const;
    }

    const paidAt = new Date();
    await tx.update(bookings).set({
      paymentStatus: "paid",
      paymentPaidAt: paidAt,
      updatedAt: paidAt,
    }).where(eq(bookings.id, booking.id));
    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      eventType: "payment_marked_paid",
      fromPaymentStatus: "unpaid",
      toPaymentStatus: "paid",
      actorUsername: session.username,
      actorRole: session.role,
      createdAt: paidAt,
    });
    return { success: true, bookingId: booking.id, paidAt, alreadyApplied: false } as const;
  });
};
