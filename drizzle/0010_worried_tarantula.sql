ALTER TABLE "order_items" ADD COLUMN "cost_cents_snapshot" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cost_cents" integer;