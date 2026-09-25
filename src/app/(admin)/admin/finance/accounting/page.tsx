import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { AccountingManager } from "@/modules/finance/components/accounting-manager";

export const metadata: Metadata = {
  title: "Contabilidad",
};

// Sin lecturas en servidor: el guard y el `<main>` los pone el layout de 019 y
// los datos llegan por API con `requirePermission` (021 D12).
export default function AdminAccountingPage() {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Contabilidad</h1>
        <p className="text-muted-foreground text-sm">
          Libro diario del mes: cada venta cobrada y cada egreso registrados en partida doble, con el Debe y
          el Haber cuadrados.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AccountingManager />
      </Suspense>
    </>
  );
}
