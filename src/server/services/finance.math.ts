export type Margin = { marginCents: number | null; marginPercent: number | null };

/**
 * Margen de catálogo (015 D5): si no hay costo cargado, ninguno de los dos
 * valores se calcula — un `costCents: null` no es un costo de `0`, así que no
 * se puede confundir un margen del 100% con la ausencia total del dato.
 * `marginPercent` se redondea a un decimal para la tabla del panel.
 */
export function computeMargin(priceCents: number, costCents: number | null): Margin {
  if (costCents === null) return { marginCents: null, marginPercent: null };

  const marginCents = priceCents - costCents;
  const marginPercent = priceCents === 0 ? 0 : Math.round((marginCents / priceCents) * 1000) / 10;

  return { marginCents, marginPercent };
}
