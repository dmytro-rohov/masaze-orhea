ALTER TABLE "bookings" RENAME COLUMN "requested_specialist_id" TO "specialist_id";--> statement-breakpoint
UPDATE "bookings"
SET "specialist_id" = "assigned_specialist_id"
WHERE "specialist_id" IS NULL
  AND "assigned_specialist_id" IS NOT NULL;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "bookings"
		WHERE "specialist_id" IS NULL
			OR (
				"assigned_specialist_id" IS NOT NULL
				AND "assigned_specialist_id" <> "specialist_id"
			)
	) THEN
		RAISE EXCEPTION 'Cannot migrate bookings: missing or conflicting specialist assignment';
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "specialist_id" SET NOT NULL;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "specialist_calendars"
		GROUP BY "specialist_id"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot migrate specialist calendars: a specialist has more than one calendar';
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_requested_specialist_id_specialists_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_assigned_specialist_id_specialists_id_fk";
--> statement-breakpoint
DROP INDEX "bookings_requested_specialist_idx";--> statement-breakpoint
DROP INDEX "bookings_assigned_specialist_idx";--> statement-breakpoint
DROP INDEX "specialist_calendars_specialist_type_unique";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_specialist_id_specialists_id_fk" FOREIGN KEY ("specialist_id") REFERENCES "public"."specialists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_specialist_idx" ON "bookings" USING btree ("specialist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "specialist_calendars_specialist_id_unique" ON "specialist_calendars" USING btree ("specialist_id");--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "assigned_specialist_id";--> statement-breakpoint
ALTER TABLE "specialist_calendars" DROP COLUMN "calendar_type";--> statement-breakpoint
DROP TYPE "public"."calendar_type";
