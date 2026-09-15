"use client";

import { useState } from "react";
import { CreditCardIcon, Trash2Icon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cardBrandLabel, formatExpiry, isExpired } from "@/modules/payment-methods/constants";
import { useDeletePaymentMethod } from "@/modules/payment-methods/hooks/use-payment-method-mutations";
import type { PaymentMethodDto } from "@/modules/payment-methods/types";

type SavedCardItemProps = { card: PaymentMethodDto };

export function SavedCardItem({ card }: SavedCardItemProps) {
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const deleteCard = useDeletePaymentMethod();

  const brand = cardBrandLabel(card.brand);
  const expiry = formatExpiry(card.expMonth, card.expYear);
  const expired = isExpired(card.expMonth, card.expYear);

  async function onConfirm() {
    try {
      await deleteCard.mutateAsync(card.id);
      toast.success(`Tarjeta ${brand} •••• ${card.last4} eliminada.`);
      setConfirmOpen(false);
    } catch {
      // El mensaje del servidor se muestra dentro del diálogo.
    }
  }

  return (
    <>
      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CreditCardIcon className="size-5 shrink-0 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{brand}</Badge>
                {/* Vencida no bloquea el borrado: es justo cuando más se quiere quitar. */}
                {expired ? <Badge variant="destructive">Vencida</Badge> : null}
              </div>
              <span className="font-medium tracking-wider">•••• {card.last4}</span>
              <span className="text-xs text-muted-foreground">Vence {expiry}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            aria-label={`Eliminar la tarjeta ${brand} terminada en ${card.last4}`}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar la tarjeta {brand} •••• {card.last4}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se desvincula de tu cuenta y no vas a poder volver a usarla sin cargarla de nuevo. Tus
              compras anteriores no se ven afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteCard.error ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteCard.error.message}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCard.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void onConfirm();
              }}
              disabled={deleteCard.isPending}
            >
              {deleteCard.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
