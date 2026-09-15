import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { SavedCardList } from "@/modules/payment-methods/components/saved-card-list";

export const metadata: Metadata = {
  title: "Mis tarjetas | E-commerce Tech",
};

export default function SavedCardsPage() {
  return (
    // La lista lee el flag `?setup=success` de la URL con useSearchParams.
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
      <SavedCardList />
    </Suspense>
  );
}
