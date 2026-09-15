import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
  qty: number;
};

type CartState = {
  items: CartItem[];
  /** Falso hasta que `persist` termina de leer `localStorage` en cliente (005 Notas). */
  hasHydrated: boolean;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  setHasHydrated: (value: boolean) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      hasHydrated: false,
      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((line) => line.productId === item.productId);

          if (!existing) {
            return { items: [...state.items, { ...item, qty }] };
          }

          return {
            items: state.items.map((line) =>
              line.productId === item.productId ? { ...line, qty: line.qty + qty } : line,
            ),
          };
        }),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((line) => line.productId !== productId) })),
      setQty: (productId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((line) => line.productId !== productId)
              : state.items.map((line) => (line.productId === productId ? { ...line, qty } : line)),
        })),
      clear: () => set({ items: [] }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "cart-storage",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

export function cartSubtotalCents(items: CartItem[]): number {
  return items.reduce((total, line) => total + line.priceCents * line.qty, 0);
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((total, line) => total + line.qty, 0);
}
