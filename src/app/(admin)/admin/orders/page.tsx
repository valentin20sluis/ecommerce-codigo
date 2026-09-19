import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { AdminOrderManager } from "@/modules/orders/components/admin-order-manager";

export const metadata: Metadata = {
  title: "Pedidos",
};

export default function AdminOrdersPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground text-sm">
          Filtra los pedidos y avanza su preparación paso a paso; cada cambio queda en la bitácora.
        </p>
      </header>

      {/* El gestor lee los filtros de la URL con useSearchParams. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AdminOrderManager />
      </Suspense>
    </main>
  );
}
