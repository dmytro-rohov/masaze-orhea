ALTER TYPE "public"."booking_payment_method" ADD VALUE 'voucher';--> statement-breakpoint
ALTER TYPE "public"."voucher_event_type" ADD VALUE 'reserved' BEFORE 'redeemed';--> statement-breakpoint
ALTER TYPE "public"."voucher_event_type" ADD VALUE 'released' BEFORE 'redeemed';--> statement-breakpoint
ALTER TYPE "public"."voucher_status" ADD VALUE 'reserved' BEFORE 'redeemed';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "voucher_id" uuid;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "booking_slot_minutes_snapshot" integer;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "booking_slot_minutes_snapshot" integer;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "booking_token_hash" text;--> statement-breakpoint
UPDATE "voucher_orders" AS "voucher_order"
SET "booking_slot_minutes_snapshot" = "variant"."booking_slot_minutes"
FROM "massage_variants" AS "variant"
WHERE "voucher_order"."voucher_type" = 'service'
  AND "voucher_order"."massage_variant_id" = "variant"."id";--> statement-breakpoint
UPDATE "vouchers" AS "voucher"
SET "booking_slot_minutes_snapshot" = "variant"."booking_slot_minutes"
FROM "massage_variants" AS "variant"
WHERE "voucher"."voucher_type" = 'service'
  AND "voucher"."massage_variant_id" = "variant"."id";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_voucher_blocking_unique" ON "bookings" USING btree ("voucher_id") WHERE "bookings"."voucher_id" IS NOT NULL AND "bookings"."status" NOT IN ('cancelled', 'rejected');--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_booking_token_hash_unique" ON "vouchers" USING btree ("booking_token_hash");--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_service_booking_slot_present" CHECK (
        "voucher_orders"."voucher_type" <> 'service'
        OR (
          "voucher_orders"."booking_slot_minutes_snapshot" IS NOT NULL
          AND "voucher_orders"."booking_slot_minutes_snapshot" > 0
        )
      );--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_service_booking_slot_present" CHECK (
        "vouchers"."voucher_type" <> 'service'
        OR (
          "vouchers"."booking_slot_minutes_snapshot" IS NOT NULL
          AND "vouchers"."booking_slot_minutes_snapshot" > 0
        )
      );
