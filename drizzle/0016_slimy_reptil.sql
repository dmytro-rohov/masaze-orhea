ALTER TABLE "voucher_orders" DROP CONSTRAINT "voucher_orders_delivery_data_valid";--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "paper_sent_at" timestamp with time zone;--> statement-breakpoint
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
          AND "voucher_orders"."shipping_street" IS NOT NULL
          AND "voucher_orders"."shipping_building_number" IS NOT NULL
          AND "voucher_orders"."shipping_postal_code" IS NOT NULL
          AND "voucher_orders"."shipping_city" IS NOT NULL
        )
      );