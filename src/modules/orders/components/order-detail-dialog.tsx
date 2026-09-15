"use client";

import { ExternalLinkIcon, Loader2Icon, ReceiptIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatPriceFromCents } from "@/lib/utils";
import { ORDER_STATUS_VIEW } from "@/modules/orders/constants";
import { useOrderReceipt } from "@/modules/orders/hooks/use-order-receipt";
import type { OrderListItemDto } from "@/modules/orders/types";
import { formatOrderTime } from "@/modules/orders/utils";

type OrderDetailDialogProps = {
  order: OrderListItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function OrderDetailDialog({ order, open, onOpenChange }: OrderDetailDialogProps) {
  // La boleta solo tiene sentido en un pedido cobrado, y solo mientras el
  // Dialog está abierto: el listado no dispara ni una llamada a Stripe (D1).
  const isPaid = order?.status === "paid";
  const receipt = useOrderReceipt(order?.id ?? "", open && isPaid);

  if (!order) return null;

  const status = ORDER_STATUS_VIEW[order.status];
  const createdAt = new Date(order.createdAt).toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Pedido #{order.id.slice(0, 8)}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </DialogTitle>
          <DialogDescription>
            {createdAt} · {formatOrderTime(order.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="flex-1">
                {item.nameSnapshot}
                <span className="block text-xs text-muted-foreground">
                  {item.qty} × {formatPriceFromCents(item.unitPriceCents)}
                </span>
              </span>
              <span className="font-medium">
                {formatPriceFromCents(item.unitPriceCents * item.qty)}
              </span>
            </li>
          ))}
        </ul>

        <Separator />

        <div className="flex items-center justify-between text-base font-semibold">
          <span>Total</span>
          <span>
            {formatPriceFromCents(order.totalCents)} {order.currency.toUpperCase()}
          </span>
        </div>

        {isPaid ? (
          <div className="flex flex-col gap-2">
            {receipt.data ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  // Pestaña nueva: la boleta es una página hosted de Stripe.
                  <a href={receipt.data.url} target="_blank" rel="noopener noreferrer" />
                }
              >
                <ReceiptIcon className="size-4" />
                Descargar boleta
                <ExternalLinkIcon className="size-4" />
              </Button>
            ) : (
              <Button variant="outline" disabled={receipt.isFetching} onClick={() => receipt.refetch()}>
                {receipt.isFetching ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Buscando la boleta…
                  </>
                ) : (
                  <>
                    <ReceiptIcon className="size-4" />
                    Reintentar la boleta
                  </>
                )}
              </Button>
            )}

            {receipt.error && !receipt.isFetching ? (
              <p role="alert" className="text-sm text-destructive">
                {receipt.error.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
