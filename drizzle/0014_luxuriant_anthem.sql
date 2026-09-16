CREATE TYPE "public"."voucher_delivery_type" AS ENUM('electronic', 'paper');--> statement-breakpoint
ALTER TABLE "voucher_orders" ALTER COLUMN "recipient_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ALTER COLUMN "recipient_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "delivery_type" "voucher_delivery_type" DEFAULT 'electronic' NOT NULL;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "delivery_fee_grosze" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "total_amount_grosze" integer;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "shipping_first_name" text;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "shipping_last_name" text;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "shipping_street" text;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "shipping_building_number" text;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "shipping_apartment_number" text;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "shipping_postal_code" text;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "shipping_city" text;--> statement-breakpoint
UPDATE "voucher_orders" SET "total_amount_grosze" = "amount_grosze";--> statement-breakpoint
ALTER TABLE "voucher_orders" ALTER COLUMN "total_amount_grosze" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_delivery_fee_non_negative" CHECK ("voucher_orders"."delivery_fee_grosze" >= 0);--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_total_amount_valid" CHECK ("voucher_orders"."total_amount_grosze" = "voucher_orders"."amount_grosze" + "voucher_orders"."delivery_fee_grosze" AND "voucher_orders"."total_amount_grosze" > 0);--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_delivery_data_valid" CHECK (
        (
          "voucher_orders"."delivery_type" = 'electronic'
          AND "voucher_orders"."delivery_fee_grosze" = 0
          AND "voucher_orders"."shipping_first_name" IS NULL
          AND "voucher_orders"."shipping_last_name" IS NULL
          AND "voucher_orders"."shipping_street" IS NULL
          AND "voucher_orders"."shipping_building_number" IS NULL
          AND "voucher_orders"."shipping_apartment_number" IS NULL
          AND "voucher_orders"."shipping_postal_code" IS NULL
          AND "voucher_orders"."shipping_city" IS NULL
        )
        OR
        (
          "voucher_orders"."delivery_type" = 'paper'
          AND "voucher_orders"."shipping_first_name" IS NOT NULL
          AND "voucher_orders"."shipping_last_name" IS NOT NULL
          AND "voucher_orders"."shipping_street" IS NOT NULL
          AND "voucher_orders"."shipping_building_number" IS NOT NULL
          AND "voucher_orders"."shipping_postal_code" IS NOT NULL
          AND "voucher_orders"."shipping_city" IS NOT NULL
        )
      );
