"use client";

import { useState } from "react";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPriceFromCents } from "@/lib/utils";
import { IncomeTaxRateDialog } from "@/modules/finance/components/income-tax-rate-dialog";
import type { TaxSummaryDto } from "@/modules/finance/types/taxes";

type IncomeTaxSectionProps = {
  summary: TaxSummaryDto;
  canManageTaxes: boolean;
};

function formatRate(rateBps: number): string {
  return `${(rateBps / 100).toLocaleString("es", { maximumFractionDigits: 2 })} %`;
}

type BreakdownLine = { sign: string; label: string; value: string; emphasis?: boolean };

export function IncomeTaxSection({ summary, canManageTaxes }: IncomeTaxSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const lines: BreakdownLine[] = [
    { sign: "", label: "Base imponible (ventas sin IGV)", value: formatPriceFromCents(summary.baseCents) },
    { sign: "−", label: "Costo de lo vendido (conocido)", value: formatPriceFromCents(summary.costKnownCents) },
    { sign: "−", label: "Egresos del periodo", value: formatPriceFromCents(summary.expensesCents) },
    { sign: "=", label: "Utilidad estimada", value: formatPriceFromCents(summary.profitCents), emphasis: true },
    { sign: "×", label: "Tasa de renta", value: formatRate(summary.incomeTaxRateBps) },
    { sign: "=", label: "Renta estimada", value: formatPriceFromCents(summary.incomeTaxCents), emphasis: true },
  ];

  const showCoverageWarning = summary.grossCents > 0 && summary.costCoveragePercent < 100;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="income-tax-heading">
      <div className="flex flex-col gap-1">
        <h2 id="income-tax-heading" className="text-lg font-semibold">
          Renta estimada
        </h2>
        <p className="text-muted-foreground text-sm">
          Cuánto impuesto a la renta generaría la utilidad del periodo. Si hubo pérdida, la renta
          estimada es 0.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl tabular-nums">{formatPriceFromCents(summary.incomeTaxCents)}</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <InfoIcon className="size-4 shrink-0" />
            Estimación de gestión, no es una declaración tributaria.
          </CardDescription>
          {canManageTaxes ? (
            <CardAction>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                Cambiar tasa
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col divide-y text-sm">
            {lines.map((line) => (
              <div
                key={line.label}
                className={`flex items-center justify-between gap-4 py-2 ${line.emphasis ? "font-semibold" : ""}`}
              >
                <dt className="flex items-center gap-2">
                  <span className="text-muted-foreground w-3 text-center" aria-hidden="true">
                    {line.sign}
                  </span>
                  {line.label}
                </dt>
                <dd className="tabular-nums">{line.value}</dd>
              </div>
            ))}
          </dl>

          <p className="text-muted-foreground text-xs">
            {summary.costCoveragePercent}% de las ventas tienen costo conocido.
          </p>

          {showCoverageWarning ? (
            <div
              role="alert"
              className="border-destructive/40 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
            >
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <p>
                Hay ventas de productos sin costo cargado: cuentan como costo 0, así que la utilidad y la
                renta están sobreestimadas. Carga el costo en Precio unitario para afinarlas.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManageTaxes ? (
        <IncomeTaxRateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          currentRateBps={summary.incomeTaxRateBps}
        />
      ) : null}
    </section>
  );
}
