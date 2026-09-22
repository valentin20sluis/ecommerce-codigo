"use client";

import { useMemo } from "react";
import { ArrowRightIcon, BanIcon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatPriceFromCents } from "@/lib/utils";
import {
  CANCELABLE_STATUSES,
  ORDER_FULFILLMENT_NEXT,
  ORDER_STATUS_VIEW,
} from "@/modules/orders/constants";
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
  /** Cancelar repone stock, así que el gestor pide confirmación antes del PATCH. */
  onCancel: (order: AdminOrderListItem) => void;
  /** Pedido con el `PATCH` en vuelo: su botón queda deshabilitado mientras dura. */
  pendingOrderId: string | null;
};

const helper = createDataTableColumnHelper<AdminOrderListItem>();

export function AdminOrderTable({
  orders,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onAdvance,
  onCancel,
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
              {formatDateTime(context.getValue())}
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
            const isCancelable = CANCELABLE_STATUSES.includes(order.status);
            const isPending = pendingOrderId === order.id;

            // Estado terminal o fuera del flujo: ni avance ni cancelación (012 AC5).
            if (!next && !isCancelable) {
              return <span className="text-muted-foreground flex justify-end text-sm">—</span>;
            }

            return (
              <div className="flex justify-end gap-2">
                {isCancelable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => onCancel(order)}
                    aria-label={`Cancelar el pedido ${order.id.slice(0, 8)} y reponer su stock`}
                  >
                    <BanIcon className="size-4" />
                    Cancelar
                  </Button>
                ) : null}

                {next ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => onAdvance(order, next)}
                    aria-label={`Avanzar el pedido ${order.id.slice(0, 8)} a ${ORDER_STATUS_VIEW[next].label}`}
                  >
                    <ArrowRightIcon className="size-4" />
                    {ORDER_STATUS_VIEW[next].label}
                  </Button>
                ) : null}
              </div>
            );
          },
        }),
      ]),
    [onAdvance, onCancel, pendingOrderId],
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
