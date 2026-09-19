import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LOW_STOCK_THRESHOLD } from "@/modules/dashboard/constants";
import type { LowStockProduct } from "@/modules/dashboard/types/metrics";

type LowStockCardProps = {
  products: LowStockProduct[];
};

export function LowStockCard({ products }: LowStockCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlertIcon className="text-destructive size-4" />
          Stock bajo
        </CardTitle>
        <CardDescription>
          Productos activos con {LOW_STOCK_THRESHOLD} unidades o menos
        </CardDescription>
      </CardHeader>

      <CardContent>
        {products.length > 0 ? (
          <ul className="flex flex-col divide-y">
            {products.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 py-2">
                {/* `q` es el filtro de texto ya existente del listado (D8). */}
                <Link
                  href={`/admin/products?q=${encodeURIComponent(product.name)}`}
                  className="truncate text-sm underline-offset-4 hover:underline"
                >
                  {product.name}
                </Link>
                <Badge variant={product.stock === 0 ? "destructive" : "secondary"}>
                  {product.stock} u.
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground flex h-52 items-center justify-center text-sm">
            Todo con stock suficiente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
