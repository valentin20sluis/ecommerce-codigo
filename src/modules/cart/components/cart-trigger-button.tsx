"use client";

import { ShoppingBagIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SheetTrigger } from "@/components/ui/sheet";
import { cartItemCount, useCartStore } from "@/modules/cart/store/cart-store";

/** Debe montarse dentro de un `<Sheet>` (lo provee `CartDrawer`). */
export function CartTriggerButton() {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  // Antes de hidratar se muestra 0: evita que el badge parpadee con datos de localStorage (005 Notas).
  const count = hasHydrated ? cartItemCount(items) : 0;

  return (
    <SheetTrigger
      render={<Button variant="ghost" size="icon" className="relative" aria-label="Carrito de compras" />}
    >
      <ShoppingBagIcon />
      {count > 0 && (
        <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px]">
          {count}
        </Badge>
      )}
    </SheetTrigger>
  );
}
