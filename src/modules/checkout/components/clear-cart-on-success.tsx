"use client";

import { useEffect } from "react";

import { useCartStore } from "@/modules/cart/store/cart-store";

/**
 * Vacía el carrito local al ver la orden propia (008 AC12). Vive en un
 * componente cliente mínimo, sin UI: la página de éxito sigue siendo servidor y
 * de solo lectura.
 */
export function ClearCartOnSuccess() {
  const clear = useCartStore((state) => state.clear);

  useEffect(() => {
    clear();
  }, [clear]);

  return null;
}
