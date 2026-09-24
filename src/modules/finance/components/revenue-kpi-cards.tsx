import { PercentIcon, TrendingUpIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPriceFromCents } from "@/lib/utils";

type RevenueKpiCardsProps = {
  revenueCents: number;
  ordersCount: number;
  marginCents: number | null;
  marginCoveragePercent: number;
};

export function RevenueKpiCards({
  revenueCents,
  ordersCount,
  marginCents,
  marginCoveragePercent,
}: RevenueKpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardDescription>Ingresos</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl tabular-nums">
            <TrendingUpIcon className="text-brand size-5" />
            {formatPriceFromCents(revenueCents)}
          </CardTitle>
          <CardDescription className="text-xs">{ordersCount} pedido(s)</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Margen bruto</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl tabular-nums">
            <PercentIcon className="text-muted-foreground size-5" />
            {marginCents === null ? "Sin dato" : formatPriceFromCents(marginCents)}
          </CardTitle>
          <CardDescription className="text-xs">
            {marginCoveragePercent}% de los ingresos con costo conocido
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
