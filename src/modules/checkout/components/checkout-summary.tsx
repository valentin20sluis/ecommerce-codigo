"use client";

import Link from "next/link";
import { ShoppingBagIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/axios";
import { formatPriceFromCents } from "@/lib/utils";
import { useCreateCheckoutSession } from "@/modules/checkout/hooks/use-create-checkout-session";
import { cartSubtotalCents, useCartStore } from "@/modules/cart/store/cart-store";
import { ProductImage } from "@/modules/products/components/storefront/product-image";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No se pudo iniciar el pago. Intenta nuevamente.";
}

export function CheckoutSummary() {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const createSession = useCreateCheckoutSession();

  // `persist` lee `localStorage` en cliente: sin este gate el primer render
  // mostraría el carrito vacío aunque tenga líneas.
  if (!hasHydrated) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  const subtotalCents = cartSubtotalCents(items);
  const isEmpty = items.length === 0;

  // La redirección la hace `onSuccess`; el botón sigue en pending mientras el
  // navegador sale hacia checkout.stripe.com.
  const isPending = createSession.isPending || createSession.isSuccess;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Resumen de tu pedido</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {isEmpty ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <ShoppingBagIcon className="size-8" />
              <p className="text-sm">Tu carrito está vacío.</p>
              <Button variant="outline" nativeButton={false} render={<Link href="/products" />}>
                Ver productos
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.imageUrl && (
                      <ProductImage src={item.imageUrl} alt={item.name} className="object-cover" />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.qty} × {formatPriceFromCents(item.priceCents)}
                    </span>
                  </div>

                  <span className="text-sm font-medium">
                    {formatPriceFromCents(item.priceCents * item.qty)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Separator />

          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatPriceFromCents(subtotalCents)}</span>
          </div>
        </CardContent>
      </Card>

      {createSession.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(createSession.error)}
        </p>
      )}

      <Button
        size="lg"
        className="w-full"
        disabled={isEmpty || isPending}
        onClick={() =>
          createSession.mutate({
            // Solo id y cantidad: el precio se relee en el servidor (AC4).
            items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
          })
        }
      >
        {isPending ? "Redirigiendo a Stripe…" : "Pagar con Stripe"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        El pago se procesa en Stripe. No guardamos datos de tu tarjeta.
      </p>
    </div>
  );
}
