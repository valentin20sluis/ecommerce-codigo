import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { CategoryManager } from "@/modules/categories/components/category-manager";

export const metadata: Metadata = {
  title: "Categorías",
};

export default function AdminCategoriesPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
        <p className="text-muted-foreground text-sm">
          Taxonomía del catálogo. Cada cambio queda registrado en la bitácora.
        </p>
      </header>

      {/* El gestor lee los filtros de la URL con useSearchParams. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CategoryManager />
      </Suspense>
    </main>
  );
}
