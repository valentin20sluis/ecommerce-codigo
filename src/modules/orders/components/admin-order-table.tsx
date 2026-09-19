"use client";

import { useMemo } from "react";
import { ArrowRightIcon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPriceFromCents } from "@/lib/utils";
import { ORDER_FULFILLMENT_NEXT, ORDER_STATUS_VIEW } from "@/modules/orders/constants";
import type { AdminOrderListItem } from "@/modules/orders/types/admin-order";
import type { OrderStatus } from "@/server/db/schema";

type AdminOrderTableProps = {
  orders: AdminOrderListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onAdvance: (order: AdminOrderListItem, next: OrderStatus) => void;
  /** Pedido con el `PATCH` en vuelo: su botón queda deshabilitado mientras dura. */
  pendingOrderId: string | null;
};

const helper = createDataTableColumnHelper<AdminOrderListItem>();

function formatDate(value: string): string {
  return new Date(value).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

export function AdminOrderTable({
  orders,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onAdvance,
  pendingOrderId,
}: AdminOrderTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("id", {
          header: "Pedido",
          cell: (context) => (
            <span className="font-mono text-xs whitespace-nowrap">
              #{context.getValue().slice(0, 8)}
            </span>
          ),
        }),
        helper.accessor("customer", {
          header: "Cliente",
          cell: (context) => {
            const customer = context.getValue();
            const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

            return (
              <div className="flex flex-col">
                <span className="text-sm font-medium">{name || "—"}</span>
                <span className="text-muted-foreground text-xs">{customer.email}</span>
              </div>
            );
          },
        }),
        helper.accessor("createdAt", {
          header: "Fecha",
          cell: (context) => (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {formatDate(context.getValue())}
            </span>
          ),
        }),
        helper.accessor("totalCents", {
          header: "Total",
          cell: (context) => (
            <span className="tabular-nums whitespace-nowrap">
              {formatPriceFromCents(context.getValue())}
            </span>
          ),
        }),
        helper.accessor("status", {
          header: "Estado",
          cell: (context) => {
            const view = ORDER_STATUS_VIEW[context.getValue()];
            return <Badge variant={view.variant}>{view.label}</Badge>;
          },
        }),
        helper.display({
          id: "actions",
          header: "Acción",
          cell: (context) => {
            const order = context.row.original;
            const next = ORDER_FULFILLMENT_NEXT[order.status];

            // Estado terminal o fuera del flujo de fulfillment: no hay avance posible (AC5).
            if (!next) {
              return <span className="text-muted-foreground flex justify-end text-sm">—</span>;
            }

            return (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingOrderId === order.id}
                  onClick={() => onAdvance(order, next)}
                  aria-label={`Avanzar el pedido ${order.id.slice(0, 8)} a ${ORDER_STATUS_VIEW[next].label}`}
                >
                  <ArrowRightIcon className="size-4" />
                  {ORDER_STATUS_VIEW[next].label}
                </Button>
              </div>
            );
          },
        }),
      ]),
    [onAdvance, pendingOrderId],
  );

  return (
    <DataTable
      columns={columns}
      data={orders}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay pedidos que coincidan con los filtros."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
