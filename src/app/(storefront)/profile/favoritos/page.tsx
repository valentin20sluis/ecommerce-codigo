import type { Metadata } from "next";
import { HeartIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Mis favoritos | E-commerce Tech",
};

// Sin servicio de favoritos todavía: solo la UI, a la espera de su propio spec.
export default function FavoritesPage() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
      <HeartIcon className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">Todavía no tenés favoritos</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Los productos que marques como favoritos van a aparecer acá.
      </p>
    </div>
  );
}
