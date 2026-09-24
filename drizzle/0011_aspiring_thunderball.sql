CREATE TYPE "public"."expense_category" AS ENUM('advertising', 'payroll', 'rent', 'software', 'shipping', 'payment_fees', 'taxes_fees', 'other');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"incurred_on" date NOT NULL,
	"recurring_expense_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"day_of_month" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"generated_through" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_expenses_amount_positive" CHECK ("recurring_expenses"."amount_cents" > 0),
	CONSTRAINT "recurring_expenses_day_of_month_range" CHECK ("recurring_expenses"."day_of_month" between 1 and 31),
	CONSTRAINT "recurring_expenses_ends_after_starts" CHECK ("recurring_expenses"."ends_on" is null or "recurring_expenses"."ends_on" >= "recurring_expenses"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("recurring_expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_incurred_on_idx" ON "expenses" USING btree ("incurred_on" desc);--> statement-breakpoint
CREATE INDEX "expenses_category_incurred_on_idx" ON "expenses" USING btree ("category","incurred_on" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_recurring_occurrence_unique" ON "expenses" USING btree ("recurring_expense_id","incurred_on") WHERE "expenses"."recurring_expense_id" is not null;