CREATE TYPE "public"."weekday" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TABLE "specialist_availability_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specialist_id" text NOT NULL,
	"date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"is_available" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "specialist_availability_overrides_time_consistency" CHECK (
        (
          "specialist_availability_overrides"."is_available" = false
          AND "specialist_availability_overrides"."start_time" IS NULL
          AND "specialist_availability_overrides"."end_time" IS NULL
        )
        OR
        (
          "specialist_availability_overrides"."is_available" = true
          AND "specialist_availability_overrides"."start_time" IS NOT NULL
          AND "specialist_availability_overrides"."end_time" IS NOT NULL
          AND "specialist_availability_overrides"."start_time" < "specialist_availability_overrides"."end_time"
        )
      )
);
--> statement-breakpoint
CREATE TABLE "specialist_availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specialist_id" text NOT NULL,
	"weekday" "weekday" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "specialist_availability_rules_unique" UNIQUE("specialist_id","weekday","start_time","end_time"),
	CONSTRAINT "specialist_availability_rules_valid_time" CHECK ("specialist_availability_rules"."start_time" < "specialist_availability_rules"."end_time")
);
--> statement-breakpoint
CREATE TABLE "specialist_availability_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specialist_id" text NOT NULL,
	"min_notice_minutes" integer DEFAULT 240 NOT NULL,
	"max_advance_days" integer DEFAULT 60 NOT NULL,
	"max_bookings_per_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "specialist_availability_settings_min_notice_non_negative" CHECK ("specialist_availability_settings"."min_notice_minutes" >= 0),
	CONSTRAINT "specialist_availability_settings_max_advance_positive" CHECK ("specialist_availability_settings"."max_advance_days" > 0),
	CONSTRAINT "specialist_availability_settings_max_bookings_positive" CHECK (
        "specialist_availability_settings"."max_bookings_per_day" IS NULL
        OR "specialist_availability_settings"."max_bookings_per_day" > 0
      )
);
--> statement-breakpoint
ALTER TABLE "specialist_availability_overrides" ADD CONSTRAINT "specialist_availability_overrides_specialist_id_specialists_id_fk" FOREIGN KEY ("specialist_id") REFERENCES "public"."specialists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_availability_rules" ADD CONSTRAINT "specialist_availability_rules_specialist_id_specialists_id_fk" FOREIGN KEY ("specialist_id") REFERENCES "public"."specialists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_availability_settings" ADD CONSTRAINT "specialist_availability_settings_specialist_id_specialists_id_fk" FOREIGN KEY ("specialist_id") REFERENCES "public"."specialists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "specialist_availability_overrides_specialist_id_idx" ON "specialist_availability_overrides" USING btree ("specialist_id");--> statement-breakpoint
CREATE INDEX "specialist_availability_overrides_date_idx" ON "specialist_availability_overrides" USING btree ("date");--> statement-breakpoint
CREATE INDEX "specialist_availability_rules_specialist_id_idx" ON "specialist_availability_rules" USING btree ("specialist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "specialist_availability_settings_specialist_id_unique" ON "specialist_availability_settings" USING btree ("specialist_id");