"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPriceFromCents } from "@/lib/utils";
import type { CategoryRevenueDto } from "@/modules/finance/types/revenue";

type RevenueByCategoryChartProps = { data: CategoryRevenueDto[] };

/** `--primary` (013 D10): `--brand` ya lo usa la tendencia diaria. */
const chartConfig = {
  revenueCents: { label: "Ingresos", color: "var(--primary)" },
} satisfies ChartConfig;

const MAX_LABEL_LENGTH = 22;

function truncate(label: string): string {
  return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;
}

export function RevenueByCategoryChart({ data }: RevenueByCategoryChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos por categoría</CardTitle>
        <CardDescription>Rango elegido</CardDescription>
      </CardHeader>

      {data.length > 0 ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full px-2">
          <BarChart accessibilityLayer data={data} layout="vertical" margin={{ right: 16 }}>
            <XAxis type="number" dataKey="revenueCents" hide />
            <YAxis
              type="category"
              dataKey="categoryName"
              tickLine={false}
              axisLine={false}
              width={150}
              tickMargin={4}
              tickFormatter={(value) => truncate(String(value))}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => formatPriceFromCents(Number(value))} />}
            />
            <Bar dataKey="revenueCents" fill="var(--primary)" radius={4} barSize={18} />
          </BarChart>
        </ChartContainer>
      ) : (
        <p className="text-muted-foreground flex h-64 items-center justify-center text-sm">
          Sin ventas en el rango.
        </p>
      )}
    </Card>
  );
}
