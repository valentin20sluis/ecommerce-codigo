import { PackageIcon, TrendingUpIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPriceFromCents } from "@/lib/utils";
import type { DashboardRange } from "@/modules/dashboard/schemas/metrics.schema";

type MetricKpiCardsProps = {
  salesCents: number;
  ordersCount: number;
  range: DashboardRange;
};

/** Solo presentación: qué cuenta como venta lo fija el server (D1). */
export function MetricKpiCards({ salesCents, ordersCount, range }: MetricKpiCardsProps) {
  const caption = `Últimos ${range} días`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardDescription>Ventas</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl tabular-nums">
            <TrendingUpIcon className="text-brand size-5" />
            {formatPriceFromCents(salesCents)}
          </CardTitle>
          <CardDescription className="text-xs">{caption}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Pedidos</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl tabular-nums">
            <PackageIcon className="text-muted-foreground size-5" />
            {ordersCount}
          </CardTitle>
          <CardDescription className="text-xs">{caption}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
