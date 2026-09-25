import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { RevenueManager } from "@/modules/finance/components/revenue-manager";

export const metadata: Metadata = {
  title: "Ingresos",
};

export default function AdminRevenuePage() {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresos</h1>
        <p className="text-muted-foreground text-sm">
          Ingresos y margen bruto real por rango de fechas, con desglose por categoría.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <RevenueManager />
      </Suspense>
    </>
  );
}
