import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { AuditLogExplorer } from "@/modules/audit/components/audit-log-explorer";

export const metadata: Metadata = {
  title: "Bitácora de auditoría",
};

export default function AdminAuditLogsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bitácora de auditoría</h1>
        <p className="text-muted-foreground text-sm">
          Traza inmutable de las mutaciones relevantes del sistema.
        </p>
      </header>

      {/* El explorador lee los filtros de la URL con useSearchParams. */}
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AuditLogExplorer />
      </Suspense>
    </main>
  );
}
