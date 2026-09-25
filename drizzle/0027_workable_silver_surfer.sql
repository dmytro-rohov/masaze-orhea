ALTER TYPE "public"."booking_event_type" ADD VALUE 'payment_link_created';--> statement-breakpoint
ALTER TYPE "public"."booking_event_type" ADD VALUE 'payment_link_sent';--> statement-breakpoint
ALTER TYPE "public"."booking_event_type" ADD VALUE 'payment_paid';--> statement-breakpoint
ALTER TABLE "booking_events" DROP CONSTRAINT "booking_events_payload_valid";--> statement-breakpoint
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
      );
