CREATE TABLE "massage_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"massage_id" text NOT NULL,
	"duration_minutes" integer,
	"duration_label" text,
	"booking_slot_minutes" integer NOT NULL,
	"price_grosze" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "massage_variants_price_non_negative" CHECK ("massage_variants"."price_grosze" >= 0),
	CONSTRAINT "massage_variants_booking_slot_positive" CHECK ("massage_variants"."booking_slot_minutes" > 0),
	CONSTRAINT "massage_variants_duration_present" CHECK (
        "massage_variants"."duration_minutes" IS NOT NULL
        OR "massage_variants"."duration_label" IS NOT NULL
      )
);
--> statement-breakpoint
CREATE TABLE "massages" (
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"booking_available" boolean DEFAULT true NOT NULL,
	"voucher_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "massage_variants" ADD CONSTRAINT "massage_variants_massage_id_massages_id_fk" FOREIGN KEY ("massage_id") REFERENCES "public"."massages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "massage_variants_massage_id_idx" ON "massage_variants" USING btree ("massage_id");