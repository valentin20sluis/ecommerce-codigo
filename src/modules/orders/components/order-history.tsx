"use client";

import { useCallback, useMemo, useState } from "react";
import { PackageIcon, TriangleAlertIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { MAX_ORDERS } from "@/modules/orders/constants";
import { OrderCard } from "@/modules/orders/components/order-card";
import { OrderDetailDialog } from "@/modules/orders/components/order-detail-dialog";
import { OrderHistoryFilters } from "@/modules/orders/components/order-history-filters";
import { useMyOrders, useOrderFilters } from "@/modules/orders/hooks/use-my-orders";
import type { OrderListItemDto } from "@/modules/orders/types";
import { groupOrdersByDay } from "@/modules/orders/utils";

function OrderHistorySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-40" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function OrderHistory() {
  const { filters, query, setPeriod, setRange } = useOrderFilters();
  const orders = useMyOrders(query);

  const [selected, setSelected] = useState<OrderListItemDto | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);

  const onSelect = useCallback((order: OrderListItemDto) => {
    setSelected(order);
    setDetailOpen(true);
  }, []);

  const groups = useMemo(() => groupOrdersByDay(orders.data?.data ?? []), [orders.data]);

  return (
    <div className="flex flex-col gap-6">
      <OrderHistoryFilters filters={filters} onPeriodChange={setPeriod} onRangeChange={setRange} />

      {orders.isLoading ? <OrderHistorySkeleton /> : null}

      {orders.error ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-destructive/40 py-16 text-center"
        >
          <TriangleAlertIcon className="size-8 text-destructive" />
          <p className="text-sm font-medium">No pudimos cargar tus compras</p>
          <p className="max-w-xs text-sm text-muted-foreground">{orders.error.message}</p>
        </div>
      ) : null}

      {!orders.isLoading && !orders.error && groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <PackageIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Todavía no tenés compras</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Cuando completes un pedido, vas a poder verlo acá.
          </p>
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.dayKey} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
          {group.orders.map((order) => (
            <OrderCard key={order.id} order={order} onSelect={onSelect} />
          ))}
        </section>
      ))}

      {orders.data?.meta.truncated ? (
        <p className="text-center text-xs text-muted-foreground">
          Mostramos las {MAX_ORDERS} compras más recientes del rango. Acotá las fechas para ver el
          resto.
        </p>
      ) : null}

      <OrderDetailDialog order={selected} open={isDetailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
