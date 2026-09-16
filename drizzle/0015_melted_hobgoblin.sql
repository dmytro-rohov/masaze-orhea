CREATE TYPE "public"."service_inquiry_status" AS ENUM('pending', 'confirmed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."service_inquiry_type" AS ENUM('event_organization', 'client_travel');--> statement-breakpoint
CREATE TABLE "report_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_email" text,
	"folder_id" text,
	"aleksandra_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "service_inquiry_type" NOT NULL,
	"status" "service_inquiry_status" DEFAULT 'pending' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"desired_date" date NOT NULL,
	"location" text NOT NULL,
	"notes" text,
	"privacy_accepted_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "service_inquiries_status_idx" ON "service_inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_inquiries_desired_date_idx" ON "service_inquiries" USING btree ("desired_date");--> statement-breakpoint
CREATE INDEX "service_inquiries_created_at_idx" ON "service_inquiries" USING btree ("created_at");