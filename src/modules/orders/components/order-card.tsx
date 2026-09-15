"use client";

import { ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPriceFromCents } from "@/lib/utils";
import { ORDER_STATUS_VIEW } from "@/modules/orders/constants";
import type { OrderListItemDto } from "@/modules/orders/types";
import { countOrderUnits, formatOrderTime } from "@/modules/orders/utils";

type OrderCardProps = {
  order: OrderListItemDto;
  onSelect: (order: OrderListItemDto) => void;
};

export function OrderCard({ order, onSelect }: OrderCardProps) {
  const status = ORDER_STATUS_VIEW[order.status];
  const units = countOrderUnits(order);

  return (
    <button
      type="button"
      onClick={() => onSelect(order)}
      className="w-full rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`Ver el detalle del pedido ${order.id.slice(0, 8)}`}
    >
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-medium">Pedido #{order.id.slice(0, 8)}</span>
            <span className="text-xs text-muted-foreground">
              {formatOrderTime(order.createdAt)} · {units} {units === 1 ? "artículo" : "artículos"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <span className="font-semibold">{formatPriceFromCents(order.totalCents)}</span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
