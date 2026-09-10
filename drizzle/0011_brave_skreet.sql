CREATE TYPE "public"."payment_provider" AS ENUM('stripe');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."voucher_order_status" AS ENUM('pending_payment', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('active', 'redeemed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."voucher_type" AS ENUM('service', 'amount');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_order_id" uuid NOT NULL,
	"provider" "payment_provider" DEFAULT 'stripe' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider_checkout_session_id" text NOT NULL,
	"provider_payment_intent_id" text,
	"amount_grosze" integer NOT NULL,
	"currency" text DEFAULT 'PLN' NOT NULL,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_grosze" > 0),
	CONSTRAINT "payments_currency_non_empty" CHECK (length(btrim("payments"."currency")) > 0)
);
--> statement-breakpoint
CREATE TABLE "voucher_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "voucher_order_status" DEFAULT 'pending_payment' NOT NULL,
	"voucher_type" "voucher_type" NOT NULL,
	"massage_id" text,
	"massage_variant_id" uuid,
	"massage_name_snapshot" text,
	"duration_minutes_snapshot" integer,
	"duration_label_snapshot" text,
	"price_grosze_snapshot" integer,
	"amount_grosze" integer NOT NULL,
	"currency" text DEFAULT 'PLN' NOT NULL,
	"buyer_first_name" text NOT NULL,
	"buyer_last_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"recipient_name" text NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voucher_orders_amount_positive" CHECK ("voucher_orders"."amount_grosze" > 0),
	CONSTRAINT "voucher_orders_currency_non_empty" CHECK (length(btrim("voucher_orders"."currency")) > 0),
	CONSTRAINT "voucher_orders_type_relations_valid" CHECK (
        (
          "voucher_orders"."voucher_type" = 'service'
          AND "voucher_orders"."massage_id" IS NOT NULL
          AND "voucher_orders"."massage_variant_id" IS NOT NULL
        )
        OR
        (
          "voucher_orders"."voucher_type" = 'amount'
          AND "voucher_orders"."massage_id" IS NULL
          AND "voucher_orders"."massage_variant_id" IS NULL
        )
      ),
	CONSTRAINT "voucher_orders_service_price_present" CHECK (
        "voucher_orders"."voucher_type" <> 'service'
        OR "voucher_orders"."price_grosze_snapshot" IS NOT NULL
      )
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_order_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "voucher_status" DEFAULT 'active' NOT NULL,
	"voucher_type" "voucher_type" NOT NULL,
	"massage_id" text,
	"massage_variant_id" uuid,
	"massage_name_snapshot" text,
	"duration_minutes_snapshot" integer,
	"duration_label_snapshot" text,
	"price_grosze_snapshot" integer,
	"amount_grosze" integer NOT NULL,
	"currency" text DEFAULT 'PLN' NOT NULL,
	"recipient_name" text NOT NULL,
	"message" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vouchers_amount_positive" CHECK ("vouchers"."amount_grosze" > 0),
	CONSTRAINT "vouchers_currency_non_empty" CHECK (length(btrim("vouchers"."currency")) > 0),
	CONSTRAINT "vouchers_expiry_after_issue" CHECK ("vouchers"."expires_at" > "vouchers"."issued_at"),
	CONSTRAINT "vouchers_type_relations_valid" CHECK (
        (
          "vouchers"."voucher_type" = 'service'
          AND "vouchers"."massage_id" IS NOT NULL
          AND "vouchers"."massage_variant_id" IS NOT NULL
        )
        OR
        (
          "vouchers"."voucher_type" = 'amount'
          AND "vouchers"."massage_id" IS NULL
          AND "vouchers"."massage_variant_id" IS NULL
        )
      ),
	CONSTRAINT "vouchers_service_price_present" CHECK (
        "vouchers"."voucher_type" <> 'service'
        OR "vouchers"."price_grosze_snapshot" IS NOT NULL
      )
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voucher_order_id_voucher_orders_id_fk" FOREIGN KEY ("voucher_order_id") REFERENCES "public"."voucher_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_massage_id_massages_id_fk" FOREIGN KEY ("massage_id") REFERENCES "public"."massages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_orders" ADD CONSTRAINT "voucher_orders_massage_variant_massage_fk" FOREIGN KEY ("massage_variant_id","massage_id") REFERENCES "public"."massage_variants"("id","massage_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_voucher_order_id_voucher_orders_id_fk" FOREIGN KEY ("voucher_order_id") REFERENCES "public"."voucher_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_massage_id_massages_id_fk" FOREIGN KEY ("massage_id") REFERENCES "public"."massages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_massage_variant_massage_fk" FOREIGN KEY ("massage_variant_id","massage_id") REFERENCES "public"."massage_variants"("id","massage_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_voucher_order_id_idx" ON "payments" USING btree ("voucher_order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_checkout_session_id_unique" ON "payments" USING btree ("provider_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_intent_id_unique" ON "payments" USING btree ("provider_payment_intent_id") WHERE "payments"."provider_payment_intent_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "voucher_orders_status_idx" ON "voucher_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voucher_orders_buyer_email_idx" ON "voucher_orders" USING btree ("buyer_email");--> statement-breakpoint
CREATE INDEX "voucher_orders_created_at_idx" ON "voucher_orders" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_voucher_order_id_unique" ON "vouchers" USING btree ("voucher_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_code_unique" ON "vouchers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "vouchers_status_idx" ON "vouchers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vouchers_expires_at_idx" ON "vouchers" USING btree ("expires_at");