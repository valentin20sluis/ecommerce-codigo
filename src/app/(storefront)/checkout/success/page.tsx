import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireAuth } from "@/lib/auth";
import { formatPriceFromCents } from "@/lib/utils";
import { ClearCartOnSuccess } from "@/modules/checkout/components/clear-cart-on-success";
import { toOrderSummaryDto } from "@/modules/checkout/types";
import type { OrderStatus } from "@/server/db/schema";
import * as orderRepository from "@/server/repositories/order.repository";

// El estado de la orden lo mueve el webhook: cachear esta página mostraría un
// pedido "pendiente" ya cobrado.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pedido | E-commerce Tech",
  robots: { index: false, follow: false },
};

const STATUS_VIEW: Record<
  OrderStatus,
  { title: string; description: string; badge: string; variant: "default" | "secondary" | "destructive" }
> = {
  paid: {
    title: "¡Gracias por tu compra!",
    description: "Tu pago fue confirmado y ya estamos preparando tu pedido.",
    badge: "Pagado",
    variant: "default",
  },
  pending_payment: {
    title: "Estamos confirmando tu pago",
    description:
      "Tu pago se está procesando. Actualiza esta página en unos segundos para ver el estado final.",
    badge: "Pendiente",
    variant: "secondary",
  },
  payment_failed: {
    title: "El pago no se completó",
    description: "Tu pedido no pudo cobrarse. Puedes volver al checkout e intentarlo de nuevo.",
    badge: "Pago rechazado",
    variant: "destructive",
  },
  canceled: {
    title: "El pedido fue cancelado",
    description: "No se realizó ningún cobro. Puedes armar tu carrito de nuevo cuando quieras.",
    badge: "Cancelado",
    variant: "destructive",
  },
  expired: {
    title: "El pedido fue cancelado",
    description:
      "La sesión de pago expiró y no se realizó ningún cobro. Puedes armar tu carrito de nuevo cuando quieras.",
    badge: "Cancelado",
    variant: "destructive",
  },
};

function StatusIcon({ status }: { status: OrderStatus }) {
  if (status === "paid") return <CheckCircle2Icon className="size-10 text-brand" />;
  if (status === "pending_payment") return <ClockIcon className="size-10 text-muted-foreground" />;
  return <XCircleIcon className="size-10 text-destructive" />;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const user = await requireAuth();
  const { session_id: sessionId } = await searchParams;

  if (typeof sessionId !== "string" || sessionId.length === 0) notFound();

  const found = await orderRepository.findByStripeSessionId(sessionId);

  // Un `session_id` ajeno o inexistente es 404: nunca se filtra el pedido de otro (AC11).
  if (!found || found.userId !== user.id) notFound();

  const order = toOrderSummaryDto(found);
  const view = STATUS_VIEW[order.status];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <ClearCartOnSuccess />

      <div className="flex flex-col items-center gap-3 text-center">
        <StatusIcon status={order.status} />
        <h1 className="text-3xl font-semibold tracking-tight">{view.title}</h1>
        <p className="text-sm text-muted-foreground">{view.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="text-base">Pedido #{order.id.slice(0, 8)}</span>
            <Badge variant={view.variant}>{view.badge}</Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
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
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="outline" nativeButton={false} render={<Link href="/products" />}>
          Seguir comprando
        </Button>
        {order.status === "payment_failed" && (
          <Button nativeButton={false} render={<Link href="/checkout" />}>
            Reintentar el pago
          </Button>
        )}
      </div>
    </main>
  );
}
