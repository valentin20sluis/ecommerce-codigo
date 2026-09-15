import type { Metadata } from "next";

import { CheckoutSummary } from "@/modules/checkout/components/checkout-summary";

export const metadata: Metadata = {
  title: "Checkout | E-commerce Tech",
  description: "Revisa tu pedido y paga de forma segura con Stripe.",
};

// La ruta ya exige sesión en `middleware.ts` (008 D2/AC1): aquí solo se compone.
export default function CheckoutPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutSummary />
    </main>
  );
}
