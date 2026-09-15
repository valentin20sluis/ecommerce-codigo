import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { formatPriceFromCents } from "@/lib/utils";
import { AddToCartControl } from "@/modules/products/components/storefront/add-to-cart-control";
import { ProductImage } from "@/modules/products/components/storefront/product-image";
import * as productRepository from "@/server/repositories/product.repository";

// `cache()` dedupe la misma consulta entre `generateMetadata` y la página (007 T5):
// ambos corren en el mismo request, sin esto se leería el producto dos veces.
const getProduct = cache((slug: string) => productRepository.findPublicBySlug(slug));

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return { title: "Producto no encontrado | E-commerce Tech" };

  return {
    title: `${product.name} | E-commerce Tech`,
    description: product.description ?? undefined,
  };
}

export default async function ProductDetailPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);

  // Slug inexistente o producto inactivo: 404 real, nunca datos vacíos silenciosos (007 AC2).
  if (!product) notFound();

  const discount = product.compareAtPriceCents
    ? Math.round((1 - product.priceCents / product.compareAtPriceCents) * 100)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Inicio
        </Link>
        <span>/</span>
        <Link href={`/products?categories=${product.categorySlug}`} className="hover:text-foreground">
          {product.categoryName}
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-muted">
          {product.imageUrl && (
            <ProductImage
              src={product.imageUrl}
              alt={product.name}
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover"
              priority
            />
          )}
          <div className="absolute top-3 left-3">
            {product.stock === 0 ? (
              <Badge variant="secondary">Agotado</Badge>
            ) : (
              discount && <Badge className="bg-brand text-brand-foreground">-{discount}%</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            href={`/products?categories=${product.categorySlug}`}
            className="w-fit text-sm text-muted-foreground hover:text-foreground"
          >
            {product.categoryName}
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{formatPriceFromCents(product.priceCents)}</span>
            {product.compareAtPriceCents && (
              <span className="text-base text-muted-foreground line-through">
                {formatPriceFromCents(product.compareAtPriceCents)}
              </span>
            )}
          </div>

          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}

          <p className="text-xs text-muted-foreground">
            {product.stock > 0 ? `${product.stock} unidades disponibles` : "Sin stock por ahora"}
          </p>

          <div className="max-w-xs pt-2">
            <AddToCartControl product={product} size="default" />
          </div>
        </div>
      </div>
    </main>
  );
}
