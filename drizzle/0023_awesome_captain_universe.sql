CREATE TABLE "booking_addons" (
	"booking_id" uuid NOT NULL,
	"addon_id" text NOT NULL,
	"name_snapshot" text NOT NULL,
	"description_snapshot" text,
	"price_grosze_snapshot" integer NOT NULL,
	"treatment_duration_minutes_snapshot" integer,
	"slot_extension_minutes_snapshot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_addons_booking_id_addon_id_pk" PRIMARY KEY("booking_id","addon_id"),
	CONSTRAINT "booking_addons_price_non_negative" CHECK ("booking_addons"."price_grosze_snapshot" >= 0),
	CONSTRAINT "booking_addons_slot_extension_non_negative" CHECK ("booking_addons"."slot_extension_minutes_snapshot" >= 0),
	CONSTRAINT "booking_addons_treatment_duration_positive" CHECK ("booking_addons"."treatment_duration_minutes_snapshot" IS NULL OR "booking_addons"."treatment_duration_minutes_snapshot" > 0)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "total_price_grosze_snapshot" integer;--> statement-breakpoint
UPDATE "bookings" SET "total_price_grosze_snapshot" = "price_grosze_snapshot";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "total_price_grosze_snapshot" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_total_price_at_least_base" CHECK ("bookings"."total_price_grosze_snapshot" >= "bookings"."price_grosze_snapshot");
