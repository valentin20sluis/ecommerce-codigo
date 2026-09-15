"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCardIcon, InfoIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SavedCardItem } from "@/modules/payment-methods/components/saved-card-item";
import {
  paymentMethodKeys,
  useMyPaymentMethods,
} from "@/modules/payment-methods/hooks/use-my-payment-methods";
import { useCreateCardSetupSession } from "@/modules/payment-methods/hooks/use-payment-method-mutations";

function SavedCardListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((row) => (
        <Skeleton key={row} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function SavedCardList() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const cards = useMyPaymentMethods();
  const createSetupSession = useCreateCardSetupSession();

  const justReturnedFromStripe = searchParams.get("setup") === "success";

  // La tarjeta la escribe el webhook (D4) y el usuario suele volver antes: al
  // aterrizar con el flag se refresca la lista, que puede haber llegado vacía.
  useEffect(() => {
    if (!justReturnedFromStripe) return;
    void queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
  }, [justReturnedFromStripe, queryClient]);

  const items = cards.data?.data ?? [];
  const isEmpty = !cards.isLoading && !cards.error && items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tus tarjetas se guardan en Stripe. Acá solo vemos la marca, los últimos 4 dígitos y el
          vencimiento.
        </p>
        <Button
          onClick={() => createSetupSession.mutate()}
          disabled={createSetupSession.isPending}
          className="shrink-0"
        >
          <PlusIcon className="size-4" />
          {createSetupSession.isPending ? "Redirigiendo…" : "Agregar tarjeta"}
        </Button>
      </div>

      {createSetupSession.error ? (
        <p role="alert" className="text-sm text-destructive">
          {createSetupSession.error.message}
        </p>
      ) : null}

      {justReturnedFromStripe ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Estamos confirmando tu tarjeta. Puede tardar unos segundos en aparecer en la lista.
          </p>
        </div>
      ) : null}

      {cards.isLoading ? <SavedCardListSkeleton /> : null}

      {cards.error ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-destructive/40 py-16 text-center"
        >
          <TriangleAlertIcon className="size-8 text-destructive" />
          <p className="text-sm font-medium">No pudimos cargar tus tarjetas</p>
          <p className="max-w-xs text-sm text-muted-foreground">{cards.error.message}</p>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <CreditCardIcon className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Todavía no tenés tarjetas guardadas</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Agregá una para tenerla a mano la próxima vez que compres.
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          {items.map((card) => (
            <SavedCardItem key={card.id} card={card} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
