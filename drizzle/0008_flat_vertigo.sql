CREATE TYPE "public"."calendar_sync_status" AS ENUM('pending', 'synced', 'failed');--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "calendar_sync_status" "calendar_sync_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "google_calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "calendar_sync_last_error" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "calendar_sync_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "calendar_synced_at" timestamp with time zone;