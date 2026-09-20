ALTER TABLE "voucher_orders" DROP CONSTRAINT "voucher_orders_total_amount_valid";--> statement-breakpoint
ALTER TABLE "voucher_orders" DROP CONSTRAINT "voucher_orders_delivery_data_valid";--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "paper_surcharge_grosze" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_paper_surcharge_non_negative" CHECK ("voucher_orders"."paper_surcharge_grosze" >= 0);--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_total_amount_valid" CHECK ("voucher_orders"."total_amount_grosze" = "voucher_orders"."amount_grosze" + "voucher_orders"."paper_surcharge_grosze" + "voucher_orders"."delivery_fee_grosze" AND "voucher_orders"."total_amount_grosze" > 0);--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_delivery_data_valid" CHECK (
        (
          "voucher_orders"."delivery_type" = 'electronic'
          AND "voucher_orders"."paper_surcharge_grosze" = 0
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