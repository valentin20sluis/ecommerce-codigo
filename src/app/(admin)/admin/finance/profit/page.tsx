import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { ProfitManager } from "@/modules/finance/components/profit-manager";

export const metadata: Metadata = {
  title: "Ganancias",
};

// Sin lecturas en servidor: el guard y el `<main>` los pone el layout de 019 y
// los datos llegan por API con `requirePermission` (Notas de 020).
export default function AdminProfitPage() {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ganancias</h1>
        <p className="text-muted-foreground text-sm">
          Cuánto ganó el negocio en el mes: de las ventas sin IGV se restan el costo de lo vendido, los
          egresos y la renta estimada.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ProfitManager />
      </Suspense>
    </>
  );
}
