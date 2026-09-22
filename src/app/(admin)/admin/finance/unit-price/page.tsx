import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { can, PERMISSIONS } from "@/lib/permissions";
import { UnitPriceManager } from "@/modules/finance/components/unit-price-manager";

export const metadata: Metadata = {
  title: "Precio unitario",
};

export default async function AdminUnitPricePage() {
  // El listado ya exige `finance.read` en el handler; el guard de página evita
  // enseñar un panel que solo respondería 403.
  const [canRead, canManageCosts] = await Promise.all([
    can(PERMISSIONS.FINANCE_READ),
    can(PERMISSIONS.FINANCE_MANAGE_COSTS),
  ]);

  if (!canRead) redirect("/admin");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Precio unitario</h1>
        <p className="text-muted-foreground text-sm">
          Costo y margen de cada producto del catálogo. El costo es confidencial: solo lo ve
          quien tiene acceso financiero.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <UnitPriceManager canManageCosts={canManageCosts} />
      </Suspense>
    </main>
  );
}
