"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/modules/cart/store/cart-store";
import type { StorefrontProduct } from "@/modules/products/components/storefront/product-card";

/**
 * Botón "+" cuando no hay unidades en el carrito, stepper `- N +` cuando sí las
 * hay (007 D3/D6) — compartido por `ProductCard`, `HeroCarousel` y el detalle de
 * producto, sin duplicar la lógica de cantidad en cada uno.
 */
export function AddToCartControl({
  product,
  size = "sm",
}: {
  product: StorefrontProduct;
  /** "default" = botón ancho con texto (detalle/hero); "sm" = ícono compacto (card). */
  size?: "sm" | "default";
}) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const setQty = useCartStore((state) => state.setQty);

  const qty = items.find((line) => line.productId === product.id)?.qty ?? 0;
  const outOfStock = product.stock === 0;

  if (qty === 0) {
    return (
      <Button
        size={size === "default" ? "default" : "icon-sm"}
        className={size === "default" ? "w-full" : undefined}
        aria-label={`Agregar ${product.name} al carrito`}
        disabled={outOfStock}
        onClick={() =>
          addItem({
            productId: product.id,
            name: product.name,
            slug: product.slug,
            priceCents: product.priceCents,
            imageUrl: product.imageUrl,
          })
        }
      >
        <PlusIcon />
        {size === "default" && "Agregar al carrito"}
      </Button>
    );
  }

  return (
    <div className={size === "default" ? "flex w-full items-center justify-center gap-3" : "flex items-center gap-1.5"}>
      <Button
        variant="outline"
        size={size === "default" ? "icon" : "icon-xs"}
        aria-label="Restar unidad"
        onClick={() => setQty(product.id, qty - 1)}
      >
        <MinusIcon />
      </Button>
      <span className="w-6 text-center text-sm font-medium">{qty}</span>
      <Button
        variant="outline"
        size={size === "default" ? "icon" : "icon-xs"}
        aria-label="Sumar unidad"
        disabled={qty >= product.stock}
        onClick={() => setQty(product.id, qty + 1)}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
