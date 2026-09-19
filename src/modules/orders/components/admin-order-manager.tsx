"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import { AdminOrderFilters } from "@/modules/orders/components/admin-order-filters";
import { AdminOrderTable } from "@/modules/orders/components/admin-order-table";
import { ORDER_STATUS_VIEW } from "@/modules/orders/constants";
import {
  useAdminOrderFilters,
  useAdminOrders,
  useAdvanceOrderStatus,
} from "@/modules/orders/hooks/use-admin-orders";
import type { AdminOrderListItem } from "@/modules/orders/types/admin-order";
import type { OrderStatus } from "@/server/db/schema";

export function AdminOrderManager() {
  const { query, setFilters, setPage, reset } = useAdminOrderFilters();
  const orders = useAdminOrders(query);

  const { mutate, isPending, variables } = useAdvanceOrderStatus();

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
        pendingOrderId={isPending ? (variables?.id ?? null) : null}
      />
    </div>
  );
}
