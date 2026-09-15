import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryPillsSection } from "@/modules/products/components/storefront/category-pills";
import { HeroCarousel } from "@/modules/products/components/storefront/hero-carousel";
import * as categoryRepository from "@/server/repositories/category.repository";
import * as productRepository from "@/server/repositories/product.repository";

// Sin esto Next prerenderiza `/` como estático en el build y nunca vuelve a leer la
// BD: un cambio de stock/precio en /admin/products no se vería hasta el próximo
// deploy. ISR de 60s mantiene la ganancia de página estática sin quedar desactualizada.
export const revalidate = 60;

// Server Component: lee el repositorio directo (docs/SETUP.md §4, "lectura inicial,
// SEO") — el home no depende de un fetch de cliente a /api/products ni /api/categories
// para su primer render (005 AC7). Esas rutas quedan listas para la futura página
// /products con filtros (005 T9/T10).
export default async function HomePage() {
  const [deals, featured, categories] = await Promise.all([
    productRepository.listPaginated({
      status: "active",
      onSale: true,
      sort: "newest",
      page: 1,
      pageSize: 6,
    }),
    productRepository.listPaginated({ status: "active", sort: "newest", page: 1, pageSize: 12 }),
    categoryRepository.listPaginated({ status: "active", page: 1, pageSize: 12 }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 sm:px-6 sm:py-12">
      <HeroCarousel products={deals.data} />

      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos destacados</h1>
          <p className="text-sm text-muted-foreground">Explora por categoría o mira todo el catálogo.</p>
        </div>
        <CategoryPillsSection categories={categories.data} products={featured.data} />

        <Button
          variant="outline"
          className="mx-auto w-fit"
          nativeButton={false}
          render={<Link href="/products" />}
        >
          Ver todo el catálogo
          <ArrowRightIcon />
        </Button>
      </section>
    </main>
  );
}
