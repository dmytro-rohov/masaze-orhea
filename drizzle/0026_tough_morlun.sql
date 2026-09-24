ALTER TABLE "bookings" ADD COLUMN "payment_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "public_creation_key" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_public_creation_key_unique" ON "bookings" USING btree ("public_creation_key");