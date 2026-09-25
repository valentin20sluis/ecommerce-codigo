import { Suspense } from "react";
import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { can, PERMISSIONS } from "@/lib/permissions";
import { ExpensesManager } from "@/modules/finance/components/expenses-manager";

export const metadata: Metadata = {
  title: "Egresos",
};

export default async function AdminExpensesPage() {
  const canManage = await can(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Egresos</h1>
        <p className="text-muted-foreground text-sm">
          Gastos operativos del negocio (publicidad, sueldos, alquiler…) y plantillas mensuales que se
          generan solas. La compra de mercadería no va aquí: su costo ya está en el costo por producto.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ExpensesManager canManage={canManage} />
      </Suspense>
    </>
  );
}
