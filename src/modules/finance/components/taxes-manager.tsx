"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IncomeTaxSection } from "@/modules/finance/components/income-tax-section";
import { RevenueRangePicker } from "@/modules/finance/components/revenue-range-picker";
import { SalesTaxSection } from "@/modules/finance/components/sales-tax-section";
import { useRevenueFilters } from "@/modules/finance/hooks/use-revenue";
import { useTaxSummary } from "@/modules/finance/hooks/use-taxes";

type TaxesManagerProps = {
  canManageTaxes: boolean;
};

function TaxesSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function TaxesManager({ canManageTaxes }: TaxesManagerProps) {
  const { filters, query, setPreset, setCustomRange } = useRevenueFilters();
  const { data, isLoading, error, refetch } = useTaxSummary(query);

  return (
    <div className="flex flex-col gap-6">
      <RevenueRangePicker filters={filters} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />

      {query === null ? (
        <p className="text-muted-foreground text-sm">Elige un rango de fechas para ver los impuestos.</p>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-destructive text-sm">No se pudo cargar el reporte: {error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <TaxesSkeleton /> : null}

      {data ? (
        <>
          {data.grossCents === 0 ? (
            <Card>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  No hubo ventas cobradas en este rango, así que no hay IGV que declarar.
                </p>
              </CardContent>
            </Card>
          ) : (
            <SalesTaxSection
              totals={{
                grossCents: data.grossCents,
                baseCents: data.baseCents,
                igvCents: data.igvCents,
              }}
              months={data.months}
            />
          )}

          <IncomeTaxSection summary={data} canManageTaxes={canManageTaxes} />
        </>
      ) : null}
    </div>
  );
}
