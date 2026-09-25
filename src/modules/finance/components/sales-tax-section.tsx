"use client";

import { useMemo } from "react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPriceFromCents } from "@/lib/utils";
import type { MonthlyTaxBreakdown, TaxBreakdown } from "@/modules/finance/taxes";

type SalesTaxSectionProps = {
  totals: TaxBreakdown;
  months: MonthlyTaxBreakdown[];
};

type SalesTaxRow = TaxBreakdown & { label: string; isTotal: boolean };

/** `YYYY-MM` → "ene 2026", leído en UTC como la consulta (018 D4). */
function formatMonth(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("es", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Amount({ cents, isTotal }: { cents: number; isTotal: boolean }) {
  return (
    <span className={isTotal ? "font-semibold tabular-nums" : "tabular-nums"}>
      {formatPriceFromCents(cents)}
    </span>
  );
}

const helper = createDataTableColumnHelper<SalesTaxRow>();

const KPIS: { key: keyof TaxBreakdown; label: string; hint: string }[] = [
  { key: "grossCents", label: "Ventas cobradas", hint: "Lo que pagaron tus clientes" },
  { key: "baseCents", label: "Base imponible", hint: "Ventas sin impuestos" },
  { key: "igvCents", label: "IGV (18 %)", hint: "Parte del impuesto para el Estado" },
];

export function SalesTaxSection({ totals, months }: SalesTaxSectionProps) {
  const rows = useMemo<SalesTaxRow[]>(
    () => [
      ...months.map((row) => ({ ...row, label: formatMonth(row.month), isTotal: false })),
      { ...totals, label: "Total del periodo", isTotal: true },
    ],
    [months, totals],
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("label", {
          header: "Mes",
          cell: (context) => (
            <span className={context.row.original.isTotal ? "font-semibold" : "capitalize"}>
              {context.getValue()}
            </span>
          ),
        }),
        helper.accessor("grossCents", {
          header: "Ventas cobradas",
          cell: (context) => <Amount cents={context.getValue()} isTotal={context.row.original.isTotal} />,
        }),
        helper.accessor("baseCents", {
          header: "Base imponible",
          cell: (context) => <Amount cents={context.getValue()} isTotal={context.row.original.isTotal} />,
        }),
        helper.accessor("igvCents", {
          header: "IGV 18 %",
          cell: (context) => <Amount cents={context.getValue()} isTotal={context.row.original.isTotal} />,
        }),
      ]),
    [],
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby="sales-tax-heading">
      <div className="flex flex-col gap-1">
        <h2 id="sales-tax-heading" className="text-lg font-semibold">
          IGV de ventas
        </h2>
        <p className="text-muted-foreground text-sm">
          Tus precios ya incluyen el IGV (18 %). La base imponible se obtiene dividiendo cada venta
          entre 1.18; el resto es IGV. El cálculo se hace mes a mes, como se declara.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KPIS.map((kpi) => (
          <Card key={kpi.key}>
            <CardHeader>
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatPriceFromCents(totals[kpi.key])}</CardTitle>
              <CardDescription className="text-xs">{kpi.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <DataTable columns={columns} data={rows} emptyMessage="Sin meses en el rango." />
    </section>
  );
}
