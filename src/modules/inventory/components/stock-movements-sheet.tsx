"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { STOCK_MOVEMENT_VIEW } from "@/modules/inventory/constants";
import { useStockMovements } from "@/modules/inventory/hooks/use-inventory";
import type { MovementsQuery } from "@/modules/inventory/schemas/inventory.schema";
import type { InventoryRowDto, StockMovementDto } from "@/modules/inventory/types/inventory";

type StockMovementsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: InventoryRowDto | null;
};

const PAGE_SIZE = 20;

function formatDelta(qtyDelta: number): string {
  return qtyDelta > 0 ? `+${qtyDelta}` : String(qtyDelta);
}

function MovementRow({ movement }: { movement: StockMovementDto }) {
  const view = STOCK_MOVEMENT_VIEW[movement.type];

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <Badge variant={view.variant}>{view.label}</Badge>
        <span
          className={`tabular-nums ${movement.qtyDelta > 0 ? "text-foreground" : "text-destructive"}`}
        >
          {formatDelta(movement.qtyDelta)} u.
        </span>
      </div>

      <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <span>{formatDateTime(movement.createdAt)}</span>
        <span>Stock: {movement.stockAfter}</span>
      </div>

      {movement.reason ? <p className="text-sm">{movement.reason}</p> : null}

      <p className="text-muted-foreground text-xs">
        {movement.actorEmail ?? "Automático"}
        {movement.referenceId ? ` · pedido #${movement.referenceId.slice(0, 8)}` : null}
      </p>
    </li>
  );
}

/**
 * El gestor lo monta con `key={producto}`: cambiar de producto remonta el sheet
 * y su paginación vuelve a la primera página sin un efecto que sincronice estado.
 */
export function StockMovementsSheet({ open, onOpenChange, product }: StockMovementsSheetProps) {
  const [page, setPage] = useState(1);

  const query: MovementsQuery = { page, pageSize: PAGE_SIZE };
  const movements = useStockMovements(open ? (product?.id ?? null) : null, query);

  const total = movements.data?.meta.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Kardex de «{product?.name ?? ""}»</SheetTitle>
          <SheetDescription>
            {total} movimiento(s). Stock actual: {product?.stock ?? 0} u.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 p-4">
          {movements.isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={`kardex-skeleton-${index}`} className="h-16 w-full" />
              ))}
            </div>
          ) : movements.error ? (
            <p role="alert" className="text-destructive text-sm">
              {movements.error.message}
            </p>
          ) : (movements.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">
              Este producto todavía no tiene movimientos.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {movements.data?.data.map((movement) => (
                <MovementRow key={movement.id} movement={movement} />
              ))}
            </ul>
          )}

          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs">
                Página {page} de {pageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || movements.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount || movements.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
