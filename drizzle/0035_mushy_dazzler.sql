CREATE TYPE "public"."booking_addon_coverage" AS ENUM('standard', 'voucher', 'extra');--> statement-breakpoint
ALTER TABLE "booking_addons" ADD COLUMN "coverage" "booking_addon_coverage" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
UPDATE "booking_addons"
SET "coverage" = 'voucher'
FROM "bookings"
WHERE "booking_addons"."booking_id" = "bookings"."id"
  AND "bookings"."payment_method" = 'voucher';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "voucher_top_up_amount_grosze" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_voucher_top_up_non_negative" CHECK ("bookings"."voucher_top_up_amount_grosze" >= 0);
