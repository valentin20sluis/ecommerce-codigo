"use client";

import { useMemo } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPriceFromCents } from "@/lib/utils";
import type { ProductListItemDto } from "@/modules/products/types";

type ProductTableProps = {
  products: ProductListItemDto[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onEdit: (product: ProductListItemDto) => void;
  onDelete: (product: ProductListItemDto) => void;
};

const helper = createDataTableColumnHelper<ProductListItemDto>();

export function ProductTable({
  products,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
}: ProductTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Producto",
          cell: (context) => (
            <div className="flex flex-col">
              <span className="font-medium">{context.getValue()}</span>
              <span className="text-muted-foreground font-mono text-xs">
                {context.row.original.slug}
              </span>
            </div>
          ),
        }),
        helper.accessor("sku", {
          header: "SKU",
          cell: (context) => (
            <span className="font-mono text-xs">{context.getValue() ?? "—"}</span>
          ),
        }),
        helper.accessor("categoryName", {
          header: "Categoría",
          cell: (context) => <span className="text-sm">{context.getValue()}</span>,
        }),
        helper.accessor("priceCents", {
          header: "Precio",
          cell: (context) => {
            const compareAtPriceCents = context.row.original.compareAtPriceCents;

            return (
              <span className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="tabular-nums">{formatPriceFromCents(context.getValue())}</span>
                {compareAtPriceCents != null ? (
                  <span className="text-muted-foreground text-xs tabular-nums line-through">
                    {formatPriceFromCents(compareAtPriceCents)}
                  </span>
                ) : null}
              </span>
            );
          },
        }),
        helper.accessor("stock", {
          header: "Stock",
          cell: (context) => <span className="tabular-nums">{context.getValue()}</span>,
        }),
        helper.accessor("isActive", {
          header: "Estado",
          cell: (context) =>
            context.getValue() ? (
              <Badge variant="secondary">Activo</Badge>
            ) : (
              <Badge variant="outline">Inactivo</Badge>
            ),
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: (context) => {
            const product = context.row.original;

            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(product)}
                  aria-label={`Editar ${product.name}`}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(product)}
                  aria-label={`Eliminar ${product.name}`}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [onEdit, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={products}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay productos que coincidan con los filtros."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
