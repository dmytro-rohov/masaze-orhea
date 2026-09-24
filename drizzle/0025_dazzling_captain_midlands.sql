CREATE TYPE "public"."booking_payment_method" AS ENUM('online', 'on_site');--> statement-breakpoint
CREATE TYPE "public"."booking_payment_status" AS ENUM('unpaid', 'pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_method" "booking_payment_method" DEFAULT 'on_site' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_status" "booking_payment_status" DEFAULT 'unpaid' NOT NULL;