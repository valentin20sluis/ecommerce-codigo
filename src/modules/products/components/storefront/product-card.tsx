"use client";

import Link from "next/link";
import { ImageOffIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, formatPriceFromCents } from "@/lib/utils";
import { AddToCartControl } from "@/modules/products/components/storefront/add-to-cart-control";
import { ProductImage } from "@/modules/products/components/storefront/product-image";

/**
 * Campos mínimos que necesita la tarjeta: subconjunto estructural compartido por la
 * fila de repositorio (Server Component, `createdAt` como `Date`) y el DTO público
 * serializado (cliente, `createdAt` como `string`) — ninguno de los dos se usa aquí.
 */
export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
  imageUrl: string | null;
  categoryName: string;
  categorySlug: string;
};

/** Sin ratings/reseñas fabricadas (005 D1): el badge sale de datos reales. */
function ProductBadge({ product }: { product: StorefrontProduct }) {
  if (product.stock === 0) {
    return <Badge variant="secondary">Agotado</Badge>;
  }

  if (product.compareAtPriceCents) {
    const discount = Math.round((1 - product.priceCents / product.compareAtPriceCents) * 100);
    return <Badge className="bg-brand text-brand-foreground">-{discount}%</Badge>;
  }

  return null;
}

export function ProductCard({
  product,
  layout = "grid",
}: {
  product: StorefrontProduct;
  /** "list" = fila horizontal para el toggle de vista del catálogo (006 D5). */
  layout?: "grid" | "list";
}) {
  const isList = layout === "list";
  const href = `/products/${product.slug}`;

  return (
    <div
      className={cn(
        "group rounded-3xl border border-border bg-card p-3",
        isList ? "flex items-center gap-4" : "flex flex-col gap-3",
      )}
    >
      {/* Imagen y nombre navegan al detalle; el control de carrito queda afuera del
          link a propósito, para no anidar un <button> dentro de un <a> (007 D2). */}
      <Link
        href={href}
        className={cn(
          "relative shrink-0 overflow-hidden rounded-2xl bg-muted",
          isList ? "size-24" : "aspect-square",
        )}
      >
        {product.imageUrl ? (
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOffIcon className="size-8" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <ProductBadge product={product} />
        </div>
      </Link>

      <div
        className={cn(
          "flex min-w-0 flex-1 gap-2 px-1",
          isList ? "flex-row items-center justify-between" : "flex-col",
        )}
      >
        <Link href={href} className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{product.categoryName}</span>
          <h3 className="truncate text-sm font-medium text-foreground">{product.name}</h3>
        </Link>

        <div className={cn("flex items-center gap-3", isList ? "shrink-0" : "mt-auto justify-between")}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold">{formatPriceFromCents(product.priceCents)}</span>
            {product.compareAtPriceCents && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPriceFromCents(product.compareAtPriceCents)}
              </span>
            )}
          </div>
          <AddToCartControl product={product} size="sm" />
        </div>
      </div>
    </div>
  );
}
