import { notFound, redirect } from "next/navigation";

import { FINANCE_SECTIONS } from "@/modules/finance/sections";

/** D3: la portada del módulo es su primera sección disponible. */
export default function AdminFinancePage() {
  const first = FINANCE_SECTIONS.find((section) => section.status === "available");
  if (!first) notFound();

  redirect(first.href);
}
