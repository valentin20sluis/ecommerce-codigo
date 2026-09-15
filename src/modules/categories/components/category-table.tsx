"use client";

import { useMemo } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CategoryDto } from "@/modules/categories/types";

type CategoryTableProps = {
  categories: CategoryDto[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onEdit: (category: CategoryDto) => void;
  onDelete: (category: CategoryDto) => void;
};

const helper = createDataTableColumnHelper<CategoryDto>();

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es", { dateStyle: "medium" });
}

export function CategoryTable({
  categories,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
}: CategoryTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Categoría",
          cell: (context) => (
            <div className="flex flex-col">
              <span className="font-medium">{context.getValue()}</span>
              <span className="text-muted-foreground font-mono text-xs">
                {context.row.original.slug}
              </span>
            </div>
          ),
        }),
        helper.accessor("description", {
          header: "Descripción",
          cell: (context) => (
            <span className="text-muted-foreground line-clamp-2 text-sm">
              {context.getValue() ?? "—"}
            </span>
          ),
        }),
        helper.accessor("isActive", {
          header: "Estado",
          cell: (context) =>
            context.getValue() ? (
              <Badge variant="secondary">Activa</Badge>
            ) : (
              <Badge variant="outline">Inactiva</Badge>
            ),
        }),
        helper.accessor("createdAt", {
          header: "Creación",
          cell: (context) => (
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              {formatDate(context.getValue())}
            </span>
          ),
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: (context) => {
            const category = context.row.original;

            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(category)}
                  aria-label={`Editar ${category.name}`}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(category)}
                  aria-label={`Eliminar ${category.name}`}
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
      data={categories}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay categorías que coincidan con los filtros."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
