"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminOrderFilters } from "@/modules/orders/components/admin-order-filters";
import { AdminOrderTable } from "@/modules/orders/components/admin-order-table";
import { ORDER_STATUS_VIEW } from "@/modules/orders/constants";
import {
  useAdminOrderFilters,
  useAdminOrders,
  useUpdateOrderStatus,
} from "@/modules/orders/hooks/use-admin-orders";
import type { AdminOrderListItem } from "@/modules/orders/types/admin-order";
import type { OrderStatus } from "@/server/db/schema";

export function AdminOrderManager() {
  const { query, setFilters, setPage, reset } = useAdminOrderFilters();
  const orders = useAdminOrders(query);

  const { mutate, isPending, variables } = useUpdateOrderStatus();

  const [pendingCancel, setPendingCancel] = useState<AdminOrderListItem | null>(null);

  const onAdvance = useCallback(
    (order: AdminOrderListItem, next: OrderStatus) => {
      mutate(
        { id: order.id, input: { status: next } },
        {
          onSuccess: () =>
            toast.success(
              `El pedido #${order.id.slice(0, 8)} pasó a «${ORDER_STATUS_VIEW[next].label}».`,
            ),
          // El 409 de una transición ya avanzada por otro admin llega con mensaje propio.
          onError: (error) => toast.error(error.message),
        },
      );
    },
    [mutate],
  );

  // Cancelar repone stock y no tiene vuelta atrás: se confirma antes del PATCH.
  const onCancel = useCallback((order: AdminOrderListItem) => setPendingCancel(order), []);

  const onConfirmCancel = useCallback(() => {
    if (!pendingCancel) return;

    const order = pendingCancel;

    mutate(
      { id: order.id, input: { status: "canceled" } },
      {
        onSuccess: () => {
          toast.success(`El pedido #${order.id.slice(0, 8)} se canceló y repuso su stock.`);
          setPendingCancel(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }, [mutate, pendingCancel]);

  return (
    <div className="flex flex-col gap-5">
      <AdminOrderFilters filters={query} onChange={setFilters} onReset={reset} />

      <AdminOrderTable
        orders={orders.data?.data ?? []}
        isLoading={orders.isLoading}
        errorMessage={orders.error?.message ?? null}
        page={query.page}
        pageSize={query.pageSize}
        total={orders.data?.meta.total ?? 0}
        onPageChange={setPage}
        onAdvance={onAdvance}
        onCancel={onCancel}
        pendingOrderId={isPending ? (variables?.id ?? null) : null}
      />

      <AlertDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancelar el pedido #{pendingCancel?.id.slice(0, 8)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              El stock de cada línea vuelve al inventario con un movimiento de devolución y el
              pedido queda cancelado. El reembolso en Stripe se gestiona aparte.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onConfirmCancel();
              }}
              disabled={isPending}
            >
              {isPending ? "Cancelando…" : "Cancelar pedido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
