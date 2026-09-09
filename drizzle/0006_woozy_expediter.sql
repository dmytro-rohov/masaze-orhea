CREATE TABLE "addons" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"treatment_duration_minutes" integer,
	"slot_extension_minutes" integer DEFAULT 0 NOT NULL,
	"price_grosze" integer,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addons_price_non_negative" CHECK ("addons"."price_grosze" IS NULL OR "addons"."price_grosze" >= 0),
	CONSTRAINT "addons_treatment_duration_positive" CHECK (
        "addons"."treatment_duration_minutes" IS NULL
        OR "addons"."treatment_duration_minutes" > 0
      ),
	CONSTRAINT "addons_slot_extension_non_negative" CHECK ("addons"."slot_extension_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "massage_addons" (
	"massage_id" text NOT NULL,
	"addon_id" text NOT NULL,
	CONSTRAINT "massage_addons_massage_id_addon_id_pk" PRIMARY KEY("massage_id","addon_id")
);
--> statement-breakpoint
ALTER TABLE "massage_addons" ADD CONSTRAINT "massage_addons_massage_id_massages_id_fk" FOREIGN KEY ("massage_id") REFERENCES "public"."massages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "massage_addons" ADD CONSTRAINT "massage_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE restrict ON UPDATE no action;