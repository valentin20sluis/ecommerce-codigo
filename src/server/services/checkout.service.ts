import type Stripe from "stripe";

import { ConflictError, NotFoundError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CHECKOUT_CURRENCY, CHECKOUT_INTEGRATION_IDENTIFIER } from "@/lib/constants";
import { getStripe } from "@/lib/stripe";
import type { CheckoutLineInput } from "@/modules/checkout/schemas/checkout.schema";
import { dbTx } from "@/server/db/pool";
import type { Product, User } from "@/server/db/schema";
import * as orderRepository from "@/server/repositories/order.repository";
import type { OrderItemValues, OrderWithItems } from "@/server/repositories/order.repository";
import * as productRepository from "@/server/repositories/product.repository";

const ENTITY_TYPE = "order";

/**
 * Relee el catálogo real. El body solo aporta `productId` y `qty`: el precio, el
 * nombre y el stock salen siempre de Postgres (008 AC4).
 */
async function resolveLines(items: CheckoutLineInput[]): Promise<OrderItemValues[]> {
  const cache = new Map<string, Product>();
  const requestedQty = new Map<string, number>();

  for (const item of items) {
    let product = cache.get(item.productId);

    if (!product) {
      const found = await productRepository.findById(item.productId);
      // Un producto dado de baja es indistinguible de uno inexistente para el
      // cliente: 404 en ambos casos, sin filtrar la existencia del registro.
      if (!found || !found.isActive) {
        throw new NotFoundError("Uno de los productos del carrito ya no está disponible.");
      }
      cache.set(found.id, found);
      product = found;
    }

    // Acumula por producto: dos líneas del mismo SKU no pueden burlar el stock.
    const total = (requestedQty.get(item.productId) ?? 0) + item.qty;
    if (total > product.stock) {
      throw new ConflictError(`No hay stock suficiente de "${product.name}".`);
    }
    requestedQty.set(item.productId, total);
  }

  return items.map((item) => {
    const product = cache.get(item.productId)!;

    return {
      productId: product.id,
      nameSnapshot: product.name,
      unitPriceCents: product.priceCents,
      qty: item.qty,
    };
  });
}

function toLineItems(order: OrderWithItems): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return order.items.map((item) => ({
    quantity: item.qty,
    price_data: {
      currency: order.currency,
      // `unitPriceCents` ya es la unidad menor de la moneda: cero conversión.
      unit_amount: item.unitPriceCents,
      product_data: { name: item.nameSnapshot },
    },
  }));
}

export type CreateCheckoutSessionResult = { orderId: string; checkoutUrl: string };

/**
 * D5: la orden se commitea **antes** de llamar a Stripe para no sostener una
 * transacción de Neon abierta durante una llamada HTTP externa. Si Stripe falla,
 * la orden queda `canceled` y el error se propaga.
 */
export async function createCheckoutSession(
  user: User,
  items: CheckoutLineInput[],
): Promise<CreateCheckoutSessionResult> {
  const lines = await resolveLines(items);
  const subtotalCents = lines.reduce((total, line) => total + line.unitPriceCents * line.qty, 0);

  const order = await dbTx.transaction(async (tx) => {
    const created = await orderRepository.createWithItems(
      tx,
      {
        userId: user.id,
        subtotalCents,
        // Sin impuestos ni envío en v1: el total es el subtotal.
        totalCents: subtotalCents,
        currency: CHECKOUT_CURRENCY,
      },
      lines,
    );

    await logAudit(tx, {
      actorId: user.id,
      action: "order.created",
      entityType: ENTITY_TYPE,
      entityId: created.id,
      metadata: {
        itemCount: created.items.length,
        totalCents: created.totalCents,
        currency: created.currency,
      },
    });

    return created;
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: toLineItems(order),
      // El webhook usa este id como fallback si la sesión llega antes del attach.
      metadata: { orderId: order.id },
      integration_identifier: CHECKOUT_INTEGRATION_IDENTIFIER,
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout`,
      // Sin `payment_method_types`: los métodos se administran desde el Dashboard.
    });

    if (!session.url) {
      throw new Error("Stripe devolvió una sesión de Checkout sin URL de redirección.");
    }

    await dbTx.transaction(async (tx) => {
      await orderRepository.attachStripeSession(tx, order.id, session.id);
    });

    return { orderId: order.id, checkoutUrl: session.url };
  } catch (error) {
    await dbTx.transaction(async (tx) => {
      await orderRepository.markCanceled(tx, order.id);

      await logAudit(tx, {
        actorId: user.id,
        action: "order.canceled",
        entityType: ENTITY_TYPE,
        entityId: order.id,
        metadata: { reason: "stripe_session_create_failed" },
        severity: "warning",
      });
    });

    throw error;
  }
}
