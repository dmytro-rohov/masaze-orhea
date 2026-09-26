CREATE TABLE "addon_conflicts" (
	"addon_a_id" text NOT NULL,
	"addon_b_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addon_conflicts_addon_a_id_addon_b_id_pk" PRIMARY KEY("addon_a_id","addon_b_id"),
	CONSTRAINT "addon_conflicts_canonical_pair" CHECK ("addon_conflicts"."addon_a_id" < "addon_conflicts"."addon_b_id")
);
--> statement-breakpoint
ALTER TABLE "addon_conflicts" ADD CONSTRAINT "addon_conflicts_addon_a_id_addons_id_fk" FOREIGN KEY ("addon_a_id") REFERENCES "public"."addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_conflicts" ADD CONSTRAINT "addon_conflicts_addon_b_id_addons_id_fk" FOREIGN KEY ("addon_b_id") REFERENCES "public"."addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addon_conflicts_addon_b_idx" ON "addon_conflicts" USING btree ("addon_b_id");