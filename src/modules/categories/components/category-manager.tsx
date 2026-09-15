"use client";

import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryDeleteDialog } from "@/modules/categories/components/category-delete-dialog";
import { CategoryFilters } from "@/modules/categories/components/category-filters";
import { CategoryFormDialog } from "@/modules/categories/components/category-form-dialog";
import { CategoryTable } from "@/modules/categories/components/category-table";
import { useCategories, useCategoryFilters } from "@/modules/categories/hooks/use-categories";
import type { CategoryDto } from "@/modules/categories/types";

type CategoryDialog = "form" | "delete" | null;

export function CategoryManager() {
  const { query, setFilters, setPage, reset } = useCategoryFilters();
  const categories = useCategories(query);

  const [dialog, setDialog] = useState<CategoryDialog>(null);
  const [active, setActive] = useState<CategoryDto | null>(null);

  const openDialog = useCallback((next: Exclude<CategoryDialog, null>, category: CategoryDto | null) => {
    setActive(category);
    setDialog(next);
  }, []);

  const onCreate = useCallback(() => openDialog("form", null), [openDialog]);
  const onEdit = useCallback(
    (category: CategoryDto) => openDialog("form", category),
    [openDialog],
  );
  const onDelete = useCallback(
    (category: CategoryDto) => openDialog("delete", category),
    [openDialog],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CategoryFilters filters={query} onChange={setFilters} onReset={reset} />

        <Button onClick={onCreate}>
          <PlusIcon className="size-4" />
          Nueva categoría
        </Button>
      </div>

      <CategoryTable
        categories={categories.data?.data ?? []}
        isLoading={categories.isLoading}
        errorMessage={categories.error?.message ?? null}
        page={query.page}
        pageSize={query.pageSize}
        total={categories.data?.meta.total ?? 0}
        onPageChange={setPage}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <CategoryFormDialog
        open={dialog === "form"}
        onOpenChange={(open) => setDialog(open ? "form" : null)}
        category={active}
      />
      <CategoryDeleteDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        category={active}
      />
    </div>
  );
}
