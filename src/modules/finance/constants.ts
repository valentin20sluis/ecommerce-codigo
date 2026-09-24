import type { ExpenseCategoryValue } from "@/modules/finance/schemas/expense.schema";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategoryValue, string> = {
  advertising: "Publicidad",
  payroll: "Sueldos",
  rent: "Alquiler",
  software: "Software y servicios",
  shipping: "Envíos",
  payment_fees: "Comisiones de pago",
  taxes_fees: "Impuestos y tasas",
  other: "Otros",
};

/** `YYYY-MM-DD` → fecha legible, leída en UTC para no correrla un día. */
export function formatDateOnly(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
