import { redirect } from "next/navigation";

import { can, PERMISSIONS } from "@/lib/permissions";
import { FinanceTabs } from "@/modules/finance/components/finance-tabs";

export default async function FinanceLayout({ children }: LayoutProps<"/admin/finance">) {
  // Los datos ya exigen `finance.read` en cada handler; el guard evita enseñar un
  // módulo que solo respondería 403.
  const canRead = await can(PERMISSIONS.FINANCE_READ);
  if (!canRead) redirect("/admin");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <FinanceTabs />
      {children}
    </main>
  );
}
