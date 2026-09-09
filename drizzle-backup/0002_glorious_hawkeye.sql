CREATE TYPE "public"."booking_location_type" AS ENUM('salon', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed', 'rejected', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."location_verification_status" AS ENUM('not_required', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."preferred_contact_time" AS ENUM('morning', 'afternoon', 'evening');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"massage_id" text NOT NULL,
	"massage_variant_id" uuid NOT NULL,
	"massage_name_snapshot" text NOT NULL,
	"duration_minutes_snapshot" integer,
	"duration_label_snapshot" text,
	"booking_slot_minutes_snapshot" integer NOT NULL,
	"price_grosze_snapshot" integer NOT NULL,
	"requested_specialist_id" text,
	"assigned_specialist_id" text,
	"requested_start_at" timestamp with time zone NOT NULL,
	"requested_end_at" timestamp with time zone NOT NULL,
	"confirmed_start_at" timestamp with time zone,
	"confirmed_end_at" timestamp with time zone,
	"location_type" "booking_location_type" NOT NULL,
	"location_verification_status" "location_verification_status" DEFAULT 'not_required' NOT NULL,
	"mobile_street" text,
	"mobile_building_number" text,
	"mobile_apartment_number" text,
	"mobile_postal_code" text,
	"mobile_city" text,
	"customer_first_name" text NOT NULL,
	"customer_last_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"contact_by_email" boolean DEFAULT false NOT NULL,
	"contact_by_phone" boolean DEFAULT false NOT NULL,
	"preferred_contact_time" "preferred_contact_time",
	"notes" text,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"privacy_accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_price_non_negative" CHECK ("bookings"."price_grosze_snapshot" >= 0),
	CONSTRAINT "bookings_booking_slot_positive" CHECK ("bookings"."booking_slot_minutes_snapshot" > 0),
	CONSTRAINT "bookings_duration_present" CHECK (
        "bookings"."duration_minutes_snapshot" IS NOT NULL
        OR "bookings"."duration_label_snapshot" IS NOT NULL
      ),
	CONSTRAINT "bookings_requested_time_valid" CHECK ("bookings"."requested_end_at" > "bookings"."requested_start_at"),
	CONSTRAINT "bookings_confirmed_time_valid" CHECK (
        (
          "bookings"."confirmed_start_at" IS NULL
          AND "bookings"."confirmed_end_at" IS NULL
        )
        OR
        (
          "bookings"."confirmed_start_at" IS NOT NULL
          AND "bookings"."confirmed_end_at" IS NOT NULL
          AND "bookings"."confirmed_end_at" > "bookings"."confirmed_start_at"
        )
      ),
	CONSTRAINT "bookings_contact_method_present" CHECK (
        "bookings"."contact_by_email" = TRUE
        OR "bookings"."contact_by_phone" = TRUE
      ),
	CONSTRAINT "bookings_mobile_address_valid" CHECK (
        (
          "bookings"."location_type" = 'salon'
          AND "bookings"."location_verification_status" = 'not_required'
        )
        OR
        (
          "bookings"."location_type" = 'mobile'
          AND "bookings"."mobile_street" IS NOT NULL
          AND "bookings"."mobile_building_number" IS NOT NULL
          AND "bookings"."mobile_postal_code" IS NOT NULL
          AND "bookings"."mobile_city" IS NOT NULL
        )
      )
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_requested_specialist_id_specialists_id_fk" FOREIGN KEY ("requested_specialist_id") REFERENCES "public"."specialists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_specialist_id_specialists_id_fk" FOREIGN KEY ("assigned_specialist_id") REFERENCES "public"."specialists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_massage_variant_massage_fk" FOREIGN KEY ("massage_variant_id","massage_id") REFERENCES "public"."massage_variants"("id","massage_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_requested_specialist_idx" ON "bookings" USING btree ("requested_specialist_id");--> statement-breakpoint
CREATE INDEX "bookings_assigned_specialist_idx" ON "bookings" USING btree ("assigned_specialist_id");--> statement-breakpoint
CREATE INDEX "bookings_requested_start_idx" ON "bookings" USING btree ("requested_start_at");--> statement-breakpoint
CREATE INDEX "bookings_confirmed_start_idx" ON "bookings" USING btree ("confirmed_start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "massage_variants_id_massage_id_unique" ON "massage_variants" USING btree ("id","massage_id");