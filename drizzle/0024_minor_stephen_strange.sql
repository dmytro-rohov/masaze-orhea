ALTER TABLE "payments" ALTER COLUMN "voucher_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_booking_id_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_exactly_one_subject" CHECK (("payments"."voucher_order_id" IS NOT NULL) <> ("payments"."booking_id" IS NOT NULL));