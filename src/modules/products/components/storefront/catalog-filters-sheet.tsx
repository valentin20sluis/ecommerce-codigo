"use client";

import { useState } from "react";
import { SlidersHorizontalIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CatalogFilterFields } from "@/modules/products/components/storefront/catalog-filter-fields";
import type { StorefrontCategory } from "@/modules/products/components/storefront/category-pills";
import type { StorefrontProductFiltersState } from "@/modules/products/hooks/use-storefront-products";
import type { PublicProductsQuery } from "@/modules/products/schemas/product.schema";
import type { FacetCounts } from "@/server/repositories/product.repository";

/** Mobile: bottom sheet (006 T7); en desktop se usa `CatalogSidebar` en su lugar. */
export function CatalogFiltersSheet({
  categories,
  facets,
  query,
  setFilters,
  resultCount,
}: {
  categories: StorefrontCategory[];
  facets: FacetCounts;
  query: PublicProductsQuery;
  setFilters: (patch: Partial<StorefrontProductFiltersState>) => void;
  resultCount: number;
}) {
  const [open, setOpen] = useState(false);
  const activeCount =
    (query.categories?.length ?? 0) + (query.priceBands?.length ?? 0) + (query.onSale ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" className="lg:hidden" />}>
        <SlidersHorizontalIcon />
        Filtros
        {activeCount > 0 && <Badge className="h-5 min-w-5 justify-center px-1">{activeCount}</Badge>}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>
        <div className="px-4">
          <CatalogFilterFields categories={categories} facets={facets} query={query} setFilters={setFilters} />
        </div>
        <SheetFooter>
          <Button className="w-full" onClick={() => setOpen(false)}>
            Ver {resultCount} resultado{resultCount === 1 ? "" : "s"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
