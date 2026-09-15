"use client";

import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductDeleteDialog } from "@/modules/products/components/product-delete-dialog";
import { ProductFilters } from "@/modules/products/components/product-filters";
import { ProductFormDialog } from "@/modules/products/components/product-form-dialog";
import { ProductTable } from "@/modules/products/components/product-table";
import { useProductFilters, useProducts } from "@/modules/products/hooks/use-products";
import type { ProductListItemDto } from "@/modules/products/types";

type ProductDialog = "form" | "delete" | null;

export function ProductManager() {
  const { query, setFilters, setPage, reset } = useProductFilters();
  const products = useProducts(query);

  const [dialog, setDialog] = useState<ProductDialog>(null);
  const [active, setActive] = useState<ProductListItemDto | null>(null);

  const openDialog = useCallback(
    (next: Exclude<ProductDialog, null>, product: ProductListItemDto | null) => {
      setActive(product);
      setDialog(next);
    },
    [],
  );

  const onCreate = useCallback(() => openDialog("form", null), [openDialog]);
  const onEdit = useCallback(
    (product: ProductListItemDto) => openDialog("form", product),
    [openDialog],
  );
  const onDelete = useCallback(
    (product: ProductListItemDto) => openDialog("delete", product),
    [openDialog],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ProductFilters filters={query} onChange={setFilters} onReset={reset} />

        <Button onClick={onCreate}>
          <PlusIcon className="size-4" />
          Nuevo producto
        </Button>
      </div>

      <ProductTable
        products={products.data?.data ?? []}
        isLoading={products.isLoading}
        errorMessage={products.error?.message ?? null}
        page={query.page}
        pageSize={query.pageSize}
        total={products.data?.meta.total ?? 0}
        onPageChange={setPage}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <ProductFormDialog
        open={dialog === "form"}
        onOpenChange={(open) => setDialog(open ? "form" : null)}
        product={active}
      />
      <ProductDeleteDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        product={active}
      />
    </div>
  );
}
