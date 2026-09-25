import type { ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPriceFromCents } from "@/lib/utils";
import { CHART_OF_ACCOUNTS } from "@/modules/finance/accounting";
import type { AccountingJournalDto } from "@/modules/finance/types/accounting";

type JournalSummaryProps = {
  journal: AccountingJournalDto;
};

function WarningAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="border-destructive/40 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export function JournalSummary({ journal }: JournalSummaryProps) {
  const { totals } = journal;
  const merchandise = CHART_OF_ACCOUNTS.merchandise;
  const showCoverageWarning = totals.grossCents > 0 && journal.costCoveragePercent < 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Totales del mes</CardTitle>
        <CardDescription>
          {journal.totalEntries} asientos. Los totales son del mes completo, no solo de esta página.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-sm">Total Debe</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatPriceFromCents(totals.debitCents)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-sm">Total Haber</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatPriceFromCents(totals.creditCents)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-sm">
              Saldo {merchandise.code} {merchandise.name}
            </dt>
            <dd className="text-xl font-semibold tabular-nums">
              {formatPriceFromCents(totals.merchandiseBalanceCents)}
            </dd>
            <dd className="text-muted-foreground text-xs">
              Negativo porque se registra la salida de lo vendido pero todavía no las compras de mercadería.
            </dd>
          </div>
        </dl>

        <p className="text-muted-foreground text-xs">
          Ventas e IGV se calculan sobre el total cobrado del mes, igual que en Impuestos; sumar asiento por
          asiento puede diferir en céntimos por redondeo.
        </p>

        {journal.balanced ? null : (
          <WarningAlert>
            El libro no cuadra: el Debe y el Haber no suman lo mismo en el mes o en algún asiento de esta
            página. Revisa los asientos marcados como descuadrados.
          </WarningAlert>
        )}

        {showCoverageWarning ? (
          <WarningAlert>
            Solo el {journal.costCoveragePercent}% de las ventas tiene costo cargado: el resto no registra
            Costo de ventas ni salida de Mercaderías. Carga el costo en Precio unitario para afinarlo.
          </WarningAlert>
        ) : null}
      </CardContent>
    </Card>
  );
}
