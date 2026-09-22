CREATE TYPE "public"."booking_source" AS ENUM('public', 'admin');--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "terms_accepted_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "privacy_accepted_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source" "booking_source" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "created_by_username" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "created_by_role" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "availability_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "availability_override_reasons" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "admin_creation_key" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_admin_creation_key_unique" ON "bookings" USING btree ("admin_creation_key");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_metadata_valid" CHECK (
        (
          "bookings"."source" = 'public'
          AND "bookings"."terms_accepted_at" IS NOT NULL
          AND "bookings"."privacy_accepted_at" IS NOT NULL
          AND "bookings"."created_by_username" IS NULL
          AND "bookings"."admin_creation_key" IS NULL
        )
        OR
        (
          "bookings"."source" = 'admin'
          AND "bookings"."terms_accepted_at" IS NULL
          AND "bookings"."privacy_accepted_at" IS NULL
          AND "bookings"."created_by_username" IS NOT NULL
          AND "bookings"."created_by_role" = 'owner'
          AND "bookings"."admin_creation_key" IS NOT NULL
        )
      );--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_override_metadata_valid" CHECK (
        (
          "bookings"."availability_override" = FALSE
          AND "bookings"."availability_override_reasons" IS NULL
        )
        OR
        (
          "bookings"."source" = 'admin'
          AND "bookings"."availability_override" = TRUE
          AND "bookings"."availability_override_reasons" IS NOT NULL
        )
      );