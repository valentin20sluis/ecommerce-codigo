CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_payment_method_id" text NOT NULL,
	"brand" text NOT NULL,
	"last4" text NOT NULL,
	"exp_month" integer NOT NULL,
	"exp_year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_stripe_payment_method_id_unique" ON "payment_methods" USING btree ("stripe_payment_method_id");--> statement-breakpoint
CREATE INDEX "payment_methods_user_id_created_at_idx" ON "payment_methods" USING btree ("user_id","created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "users_stripe_customer_id_unique" ON "users" USING btree ("stripe_customer_id");