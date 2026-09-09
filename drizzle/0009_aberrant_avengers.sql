CREATE TABLE "booking_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"buffer_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_settings_buffer_non_negative" CHECK ("booking_settings"."buffer_minutes" >= 0)
);
