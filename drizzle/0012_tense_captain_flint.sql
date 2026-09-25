CREATE TABLE "finance_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"income_tax_rate_bps" integer NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_settings_single_row" CHECK ("finance_settings"."id" = 1),
	CONSTRAINT "finance_settings_income_tax_rate_range" CHECK ("finance_settings"."income_tax_rate_bps" between 0 and 10000)
);
--> statement-breakpoint
ALTER TABLE "finance_settings" ADD CONSTRAINT "finance_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;