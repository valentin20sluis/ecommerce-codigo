CREATE TYPE "public"."stock_movement_type" AS ENUM('initial', 'sale', 'return', 'adjustment', 'waste', 'restock');--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"qty_delta" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"reason" text,
	"reference_type" text,
	"reference_id" uuid,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_qty_delta_not_zero" CHECK ("stock_movements"."qty_delta" <> 0),
	CONSTRAINT "stock_movements_reason_required" CHECK ("stock_movements"."type" not in ('adjustment', 'waste') or "stock_movements"."reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "low_stock_threshold" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_product_id_created_at_idx" ON "stock_movements" USING btree ("product_id","created_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_reference_unique" ON "stock_movements" USING btree ("reference_type","reference_id","product_id","type") WHERE "stock_movements"."reference_id" is not null;--> statement-breakpoint
--- Backfill `initial` escrito a mano (014 T2): sin él, `sum(qty_delta)` no cuadra
--- con `products.stock` para el catálogo anterior al módulo (AC6). El `NOT EXISTS`
--- global lo deja correr una sola vez; `stock <> 0` respeta el CHECK de qty_delta.
INSERT INTO "stock_movements" ("product_id", "type", "qty_delta", "stock_after", "created_at")
SELECT "id", 'initial', "stock", "stock", now() FROM "products"
WHERE "stock" <> 0 AND NOT EXISTS (SELECT 1 FROM "stock_movements");