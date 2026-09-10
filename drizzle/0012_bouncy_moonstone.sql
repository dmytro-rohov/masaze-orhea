CREATE TYPE "public"."voucher_email_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "email_delivery_status" "voucher_email_delivery_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "email_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "email_last_error" text;--> statement-breakpoint
CREATE INDEX "vouchers_email_delivery_status_idx" ON "vouchers" USING btree ("email_delivery_status");