ALTER TYPE "public"."booking_event_type" ADD VALUE 'payment_marked_paid';--> statement-breakpoint
ALTER TABLE "booking_events" DROP CONSTRAINT "booking_events_payload_valid";--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "from_payment_status" "booking_payment_status";--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "to_payment_status" "booking_payment_status";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_paid_at" timestamp with time zone;--> statement-breakpoint
UPDATE "bookings" AS booking
SET "payment_paid_at" = paid_payment."paid_at"
FROM (
  SELECT "booking_id", MIN("paid_at") AS "paid_at"
  FROM "payments"
  WHERE "booking_id" IS NOT NULL AND "status" = 'paid' AND "paid_at" IS NOT NULL
  GROUP BY "booking_id"
) AS paid_payment
WHERE booking."id" = paid_payment."booking_id"
  AND booking."payment_method" = 'online'
  AND booking."payment_status" = 'paid';--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_payload_valid" CHECK (
        (
          "booking_events"."event_type" = 'status_changed'
          AND "booking_events"."from_status" IS NOT NULL
          AND "booking_events"."to_status" IS NOT NULL
        )
        OR
        (
          "booking_events"."event_type" = 'rescheduled'
          AND "booking_events"."previous_start_at" IS NOT NULL
          AND "booking_events"."previous_end_at" IS NOT NULL
          AND "booking_events"."new_start_at" IS NOT NULL
          AND "booking_events"."new_end_at" IS NOT NULL
        )
        OR
        (
          "booking_events"."event_type" = 'specialist_changed'
          AND "booking_events"."previous_specialist_id" IS NOT NULL
          AND "booking_events"."new_specialist_id" IS NOT NULL
        )
        OR "booking_events"."event_type"::text IN ('payment_link_created', 'payment_link_sent', 'payment_paid')
        OR (
          "booking_events"."event_type"::text = 'payment_marked_paid'
          AND "booking_events"."from_payment_status" IS NOT NULL
          AND "booking_events"."to_payment_status" IS NOT NULL
        )
      );
