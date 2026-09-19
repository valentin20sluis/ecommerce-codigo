"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TOP_PRODUCTS_LIMIT } from "@/modules/dashboard/constants";
import type { TopProductRow } from "@/modules/dashboard/types/metrics";

type TopProductsChartProps = {
  data: TopProductRow[];
};

/** `--primary` (D10): el protagonista con `--brand` es la serie de ventas. */
const chartConfig = {
  units: { label: "Unidades", color: "var(--primary)" },
} satisfies ChartConfig;

const MAX_LABEL_LENGTH = 22;

function truncate(label: string): string {
  return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top {TOP_PRODUCTS_LIMIT} productos</CardTitle>
        <CardDescription>Unidades vendidas en el rango</CardDescription>
      </CardHeader>

      {data.length > 0 ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full px-2">
          <BarChart accessibilityLayer data={data} layout="vertical" margin={{ right: 16 }}>
            <XAxis type="number" dataKey="units" hide />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={150}
              tickMargin={4}
              tickFormatter={(value) => truncate(String(value))}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `${Number(value)} u.`} />}
            />
            <Bar dataKey="units" fill="var(--primary)" radius={4} barSize={18} />
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
