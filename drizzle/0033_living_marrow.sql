CREATE TABLE "voucher_order_addons" (
	"voucher_order_id" uuid NOT NULL,
	"addon_id" text NOT NULL,
	"name_snapshot" text NOT NULL,
	"description_snapshot" text,
	"price_grosze_snapshot" integer NOT NULL,
	"treatment_duration_minutes_snapshot" integer,
	"slot_extension_minutes_snapshot" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voucher_order_addons_voucher_order_id_addon_id_pk" PRIMARY KEY("voucher_order_id","addon_id"),
	CONSTRAINT "voucher_order_addons_price_non_negative" CHECK ("voucher_order_addons"."price_grosze_snapshot" >= 0),
	CONSTRAINT "voucher_order_addons_slot_extension_non_negative" CHECK ("voucher_order_addons"."slot_extension_minutes_snapshot" >= 0),
	CONSTRAINT "voucher_order_addons_treatment_duration_positive" CHECK ("voucher_order_addons"."treatment_duration_minutes_snapshot" IS NULL OR "voucher_order_addons"."treatment_duration_minutes_snapshot" > 0)
);
--> statement-breakpoint
ALTER TABLE "voucher_orders" DROP CONSTRAINT "voucher_orders_total_amount_valid";--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD COLUMN "addons_total_grosze" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "voucher_order_addons" ADD CONSTRAINT "voucher_order_addons_voucher_order_id_voucher_orders_id_fk" FOREIGN KEY ("voucher_order_id") REFERENCES "public"."voucher_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_order_addons" ADD CONSTRAINT "voucher_order_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_addons_total_non_negative" CHECK ("voucher_orders"."addons_total_grosze" >= 0);--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_total_amount_valid" CHECK ("voucher_orders"."total_amount_grosze" = "voucher_orders"."amount_grosze" + "voucher_orders"."addons_total_grosze" + "voucher_orders"."paper_surcharge_grosze" + "voucher_orders"."delivery_fee_grosze" AND "voucher_orders"."total_amount_grosze" > 0);