CREATE TYPE "public"."voucher_event_type" AS ENUM('redeemed', 'restored');--> statement-breakpoint
CREATE TABLE "voucher_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" uuid NOT NULL,
	"event_type" "voucher_event_type" NOT NULL,
	"actor_username" text,
	"actor_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voucher_events" ADD CONSTRAINT "voucher_events_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voucher_events_voucher_id_created_at_idx" ON "voucher_events" USING btree ("voucher_id","created_at");--> statement-breakpoint
INSERT INTO "voucher_events" ("voucher_id", "event_type", "created_at")
SELECT "vouchers"."id", 'redeemed', "vouchers"."redeemed_at"
FROM "vouchers"
WHERE "vouchers"."status" = 'redeemed'
	AND "vouchers"."redeemed_at" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "voucher_events"
		WHERE "voucher_events"."voucher_id" = "vouchers"."id"
			AND "voucher_events"."event_type" = 'redeemed'
			AND "voucher_events"."created_at" = "vouchers"."redeemed_at"
	);
