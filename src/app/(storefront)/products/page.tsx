import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { CatalogManager } from "@/modules/products/components/storefront/catalog-manager";

export const metadata: Metadata = {
  title: "Catálogo | E-commerce Tech",
};

export default function ProductsPage() {
  return (
    // El manager lee los filtros de la URL con useSearchParams (006 D3).
    <Suspense fallback={<Skeleton className="mx-auto my-8 h-96 w-full max-w-6xl" />}>
      <CatalogManager />
    </Suspense>
  );
}
