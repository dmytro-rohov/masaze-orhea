CREATE TYPE "public"."specialist_calendar_purpose" AS ENUM('availability', 'bookings');--> statement-breakpoint
DROP INDEX "specialist_calendars_specialist_id_unique";--> statement-breakpoint
ALTER TABLE "specialist_calendars" ADD COLUMN "purpose" "specialist_calendar_purpose" DEFAULT 'bookings' NOT NULL;--> statement-breakpoint
ALTER TABLE "specialist_calendars" ALTER COLUMN "purpose" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "specialist_calendars_specialist_id_purpose_unique" ON "specialist_calendars" USING btree ("specialist_id","purpose");
