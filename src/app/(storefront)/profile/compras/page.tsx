import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { OrderHistory } from "@/modules/orders/components/order-history";

export const metadata: Metadata = {
  title: "Mis compras | E-commerce Tech",
};

export default function OrdersPage() {
  return (
    // El historial lee los filtros de la URL con useSearchParams.
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
      <OrderHistory />
    </Suspense>
  );
}
