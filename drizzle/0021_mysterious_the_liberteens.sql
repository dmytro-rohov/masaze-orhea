CREATE TYPE "public"."booking_event_type" AS ENUM('status_changed', 'rescheduled', 'specialist_changed');--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"event_type" "booking_event_type" NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status",
	"previous_start_at" timestamp with time zone,
	"previous_end_at" timestamp with time zone,
	"new_start_at" timestamp with time zone,
	"new_end_at" timestamp with time zone,
	"previous_specialist_id" text,
	"new_specialist_id" text,
	"actor_username" text,
	"actor_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_events_payload_valid" CHECK (
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
      )
);
--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_events_booking_id_created_at_idx" ON "booking_events" USING btree ("booking_id","created_at");--> statement-breakpoint
INSERT INTO "booking_events" (
	"booking_id",
	"event_type",
	"from_status",
	"to_status",
	"created_at"
)
SELECT
	"bookings"."id",
	'status_changed',
	'pending',
	'confirmed',
	"bookings"."confirmed_at"
FROM "bookings"
WHERE "bookings"."confirmed_at" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "booking_events"
		WHERE "booking_events"."booking_id" = "bookings"."id"
			AND "booking_events"."event_type" = 'status_changed'
			AND "booking_events"."to_status" = 'confirmed'
			AND "booking_events"."created_at" = "bookings"."confirmed_at"
	);--> statement-breakpoint
INSERT INTO "booking_events" (
	"booking_id",
	"event_type",
	"from_status",
	"to_status",
	"created_at"
)
SELECT
	"bookings"."id",
	'status_changed',
	'confirmed',
	'cancelled',
	"bookings"."cancelled_at"
FROM "bookings"
WHERE "bookings"."cancelled_at" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "booking_events"
		WHERE "booking_events"."booking_id" = "bookings"."id"
			AND "booking_events"."event_type" = 'status_changed'
			AND "booking_events"."to_status" = 'cancelled'
			AND "booking_events"."created_at" = "bookings"."cancelled_at"
	);--> statement-breakpoint
INSERT INTO "booking_events" (
	"booking_id",
	"event_type",
	"from_status",
	"to_status",
	"created_at"
)
SELECT
	"bookings"."id",
	'status_changed',
	'pending',
	'rejected',
	"bookings"."rejected_at"
FROM "bookings"
WHERE "bookings"."rejected_at" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "booking_events"
		WHERE "booking_events"."booking_id" = "bookings"."id"
			AND "booking_events"."event_type" = 'status_changed'
			AND "booking_events"."to_status" = 'rejected'
			AND "booking_events"."created_at" = "bookings"."rejected_at"
	);
