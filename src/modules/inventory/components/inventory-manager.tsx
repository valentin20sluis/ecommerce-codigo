"use client";

import { useCallback, useState } from "react";

import { InventoryFilters } from "@/modules/inventory/components/inventory-filters";
import { InventoryTable } from "@/modules/inventory/components/inventory-table";
import { StockAdjustDialog } from "@/modules/inventory/components/stock-adjust-dialog";
import { StockMovementsSheet } from "@/modules/inventory/components/stock-movements-sheet";
import { useInventory, useInventoryFilters } from "@/modules/inventory/hooks/use-inventory";
import type { InventoryRowDto } from "@/modules/inventory/types/inventory";

type InventoryManagerProps = {
  /** Lo resuelve la página en servidor con `can('inventory.adjust')`. */
  canAdjust: boolean;
};

type InventoryPanel = "adjust" | "movements" | null;

export function InventoryManager({ canAdjust }: InventoryManagerProps) {
  const { query, setFilters, setPage, reset } = useInventoryFilters();
  const inventory = useInventory(query);

  const [panel, setPanel] = useState<InventoryPanel>(null);
  const [active, setActive] = useState<InventoryRowDto | null>(null);

  const openPanel = useCallback((next: Exclude<InventoryPanel, null>, row: InventoryRowDto) => {
    setActive(row);
    setPanel(next);
  }, []);

  const onAdjust = useCallback(
    (row: InventoryRowDto) => openPanel("adjust", row),
    [openPanel],
  );

  const onViewMovements = useCallback(
    (row: InventoryRowDto) => openPanel("movements", row),
    [openPanel],
  );

  return (
    <div className="flex flex-col gap-5">
      <InventoryFilters filters={query} onChange={setFilters} onReset={reset} />

      <InventoryTable
        rows={inventory.data?.data ?? []}
        isLoading={inventory.isLoading}
        errorMessage={inventory.error?.message ?? null}
        page={query.page}
        pageSize={query.pageSize}
        total={inventory.data?.meta.total ?? 0}
        onPageChange={setPage}
        onAdjust={onAdjust}
        onViewMovements={onViewMovements}
        canAdjust={canAdjust}
      />

      <StockAdjustDialog
        open={panel === "adjust"}
        onOpenChange={(open) => setPanel(open ? "adjust" : null)}
        product={active}
      />
      <StockMovementsSheet
        key={active?.id ?? "none"}
        open={panel === "movements"}
        onOpenChange={(open) => setPanel(open ? "movements" : null)}
        product={active}
      />
    </div>
  );
}
