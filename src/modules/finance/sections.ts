type FinanceSectionStatus = "available" | "soon";

/** Única fuente de las secciones de Finanzas (D1): activar una fase = crear su página y pasar a `available`. */
export const FINANCE_SECTIONS = [
  { slug: "unit-price", label: "Precio unitario", href: "/admin/finance/unit-price", status: "available" },
  { slug: "revenue", label: "Ingresos", href: "/admin/finance/revenue", status: "available" },
  { slug: "expenses", label: "Egresos", href: "/admin/finance/expenses", status: "available" },
  { slug: "taxes", label: "Impuestos", href: "/admin/finance/taxes", status: "soon" },
  { slug: "profit", label: "Ganancias", href: "/admin/finance/profit", status: "soon" },
  { slug: "accounting", label: "Contabilidad", href: "/admin/finance/accounting", status: "soon" },
] as const satisfies readonly {
  slug: string;
  label: string;
  href: string;
  status: FinanceSectionStatus;
}[];

export type FinanceSection = (typeof FINANCE_SECTIONS)[number];
