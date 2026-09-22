import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { can, PERMISSIONS } from "@/lib/permissions";
import { InventoryManager } from "@/modules/inventory/components/inventory-manager";

export const metadata: Metadata = {
  title: "Inventario",
};

export default async function AdminInventoryPage() {
  // El listado ya exige `inventory.read` en el handler; el guard de página evita
  // enseñar un panel que solo respondería 403 (AC8).
  const [canRead, canAdjust] = await Promise.all([
    can(PERMISSIONS.INVENTORY_READ),
    can(PERMISSIONS.INVENTORY_ADJUST),
  ]);

  if (!canRead) redirect("/admin");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-muted-foreground text-sm">
          Consulta el stock de cada producto, registra ajustes con motivo y revisa el kardex
          completo: ninguna entrada o salida queda sin rastro.
        </p>
      </header>

      {/* El gestor lee los filtros de la URL con useSearchParams. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <InventoryManager canAdjust={canAdjust} />
      </Suspense>
    </main>
  );
}
