import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard, type StorefrontProduct } from "@/modules/products/components/storefront/product-card";

export function ProductGrid({
  products,
  emptyMessage = "Todavía no hay productos para mostrar.",
  view = "grid",
}: {
  products: StorefrontProduct[];
  emptyMessage?: string;
  /** "list" = una columna, card en fila (006 D5): mismo componente, solo cambia el CSS. */
  view?: "grid" | "list";
}) {
  if (products.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div
      className={cn(
        view === "list" ? "flex flex-col gap-3" : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
      )}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} layout={view} />
      ))}
    </div>
  );
}

/** Para la futura página `/products` con fetch cliente (005 T9/T10); el home no la usa. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="aspect-square rounded-3xl" />
      ))}
    </div>
  );
}
