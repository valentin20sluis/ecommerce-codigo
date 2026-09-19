ALTER TYPE "public"."order_status" ADD VALUE 'processing' BEFORE 'payment_failed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'shipped' BEFORE 'payment_failed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'delivered' BEFORE 'payment_failed';