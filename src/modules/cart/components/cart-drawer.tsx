"use client";

import Link from "next/link";
import { MinusIcon, PlusIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPriceFromCents } from "@/lib/utils";
import { CartTriggerButton } from "@/modules/cart/components/cart-trigger-button";
import { cartSubtotalCents, useCartStore } from "@/modules/cart/store/cart-store";
import { ProductImage } from "@/modules/products/components/storefront/product-image";

export function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const setQty = useCartStore((state) => state.setQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const subtotalCents = hasHydrated ? cartSubtotalCents(items) : 0;
  const isEmpty = !hasHydrated || items.length === 0;

  return (
    <Sheet>
      <CartTriggerButton />
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tu carrito</SheetTitle>
          <SheetDescription>
            {hasHydrated && items.length > 0
              ? `${items.length} producto${items.length === 1 ? "" : "s"} en tu carrito.`
              : "Los productos que agregues aparecen aquí."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {!hasHydrated || items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <ShoppingBagIcon className="size-8" />
              <p className="text-sm">Tu carrito está vacío.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.imageUrl && (
                      <ProductImage src={item.imageUrl} alt={item.name} className="object-cover" />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{item.name}</p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar ${item.name} del carrito`}
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon-xs"
                          aria-label="Restar unidad"
                          onClick={() => setQty(item.productId, item.qty - 1)}
                        >
                          <MinusIcon />
                        </Button>
                        <span className="w-6 text-center text-sm">{item.qty}</span>
                        <Button
                          variant="outline"
                          size="icon-xs"
                          aria-label="Sumar unidad"
                          onClick={() => setQty(item.productId, item.qty + 1)}
                        >
                          <PlusIcon />
                        </Button>
                      </div>
                      <span className="text-sm font-medium">
                        {formatPriceFromCents(item.priceCents * item.qty)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        <SheetFooter>
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Subtotal</span>
            <span>{formatPriceFromCents(subtotalCents)}</span>
          </div>
          {isEmpty ? (
            <Button disabled className="w-full" size="lg">
              Finalizar compra
            </Button>
          ) : (
            // `SheetClose` cierra el drawer al navegar: el header persiste entre
            // rutas del storefront, así que no se cierra solo.
            <SheetClose
              nativeButton={false}
              className={buttonVariants({ size: "lg", className: "w-full" })}
              render={<Link href="/checkout" />}
            >
              Finalizar compra
            </SheetClose>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
