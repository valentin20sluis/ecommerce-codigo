/**
 * Etiquetas de marca de `card.brand`. Stripe la devuelve en minúsculas y con
 * guiones bajos; el mapa cubre las que emite hoy y el fallback capitaliza
 * cualquier valor nuevo en vez de mostrarlo crudo.
 */
const CARD_BRAND_LABELS: Record<string, string> = {
  amex: "American Express",
  cartes_bancaires: "Cartes Bancaires",
  diners: "Diners Club",
  discover: "Discover",
  eftpos_au: "Eftpos Australia",
  jcb: "JCB",
  link: "Link",
  mastercard: "Mastercard",
  unionpay: "UnionPay",
  unknown: "Tarjeta",
  visa: "Visa",
};

export function cardBrandLabel(brand: string): string {
  return CARD_BRAND_LABELS[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

/** `MM/AAAA` con el mes siempre a dos dígitos. */
export function formatExpiry(expMonth: number, expYear: number): string {
  return `${String(expMonth).padStart(2, "0")}/${expYear}`;
}

/**
 * Una tarjeta vale hasta el último día de su mes de vencimiento: `new Date(y, m, 1)`
 * con el mes 1-based ya es el día 1 del mes siguiente, o sea el instante en que
 * expira. Puro y con `now` inyectable para poder razonarlo sin depender del reloj.
 */
export function isExpired(expMonth: number, expYear: number, now: Date = new Date()): boolean {
  return now >= new Date(expYear, expMonth, 1);
}
