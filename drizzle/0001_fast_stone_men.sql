CREATE TYPE "public"."calendar_type" AS ENUM('business', 'private');--> statement-breakpoint
CREATE TABLE "specialist_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specialist_id" text NOT NULL,
	"calendar_type" "calendar_type" NOT NULL,
	"google_calendar_id" text NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specialists" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "specialist_calendars" ADD CONSTRAINT "specialist_calendars_specialist_id_specialists_id_fk" FOREIGN KEY ("specialist_id") REFERENCES "public"."specialists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "specialist_calendars_specialist_type_unique" ON "specialist_calendars" USING btree ("specialist_id","calendar_type");--> statement-breakpoint
CREATE UNIQUE INDEX "specialist_calendars_google_calendar_id_unique" ON "specialist_calendars" USING btree ("google_calendar_id");