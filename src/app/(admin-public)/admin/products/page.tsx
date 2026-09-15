import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { ProductManager } from "@/modules/products/components/product-manager";

export const metadata: Metadata = {
  title: "Productos",
};

export default function AdminProductsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
        <p className="text-muted-foreground text-sm">
          Catálogo de la tienda. Cada cambio queda registrado en la bitácora.
        </p>
      </header>

      {/* El gestor lee los filtros de la URL con useSearchParams. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ProductManager />
      </Suspense>
    </main>
  );
}
