import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { can, PERMISSIONS } from "@/lib/permissions";
import { TaxesManager } from "@/modules/finance/components/taxes-manager";

export const metadata: Metadata = {
  title: "Impuestos",
};

// Solo calcula un booleano: los datos llegan por API con `requirePermission` (Notas de 019).
export default async function AdminTaxesPage() {
  const canManageTaxes = await can(PERMISSIONS.FINANCE_MANAGE_TAXES);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Impuestos</h1>
        <p className="text-muted-foreground text-sm">
          Cuánto IGV contienen tus ventas cobradas, mes a mes, y una estimación del impuesto a la renta
          del periodo.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TaxesManager canManageTaxes={canManageTaxes} />
      </Suspense>
    </>
  );
}
