"use client";

import { useCallback, useState } from "react";

import { EditCostDialog } from "@/modules/finance/components/edit-cost-dialog";
import { UnitPriceFilters } from "@/modules/finance/components/unit-price-filters";
import { UnitPriceTable } from "@/modules/finance/components/unit-price-table";
import { useUnitPriceFilters, useUnitPrices } from "@/modules/finance/hooks/use-unit-price";
import type { UnitPriceRowDto } from "@/modules/finance/types/finance";

type UnitPriceManagerProps = {
  /** Lo resuelve la página en servidor con `can('finance.manage_costs')`. */
  canManageCosts: boolean;
};

export function UnitPriceManager({ canManageCosts }: UnitPriceManagerProps) {
  const { query, setFilters, setPage } = useUnitPriceFilters();
  const unitPrices = useUnitPrices(query);

  const [editing, setEditing] = useState<UnitPriceRowDto | null>(null);

  const onEditCost = useCallback((row: UnitPriceRowDto) => setEditing(row), []);

  return (
    <div className="flex flex-col gap-5">
      <UnitPriceFilters filters={query} onChange={setFilters} />

      <UnitPriceTable
        rows={unitPrices.data?.data ?? []}
        isLoading={unitPrices.isLoading}
        errorMessage={unitPrices.error?.message ?? null}
        page={query.page}
        pageSize={query.pageSize}
        total={unitPrices.data?.meta.total ?? 0}
        onPageChange={setPage}
        onEditCost={onEditCost}
        canManageCosts={canManageCosts}
      />

      <EditCostDialog
        open={editing !== null}
        onOpenChange={(open) => setEditing(open ? editing : null)}
        product={editing}
      />
    </div>
  );
}
