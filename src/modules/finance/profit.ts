// Sin imports de valor con alias `@/`: este archivo corre bajo `node --test` (018 D11).

/** Mes contable `YYYY-MM`, siempre leído en UTC (020 D4). */
export type UtcMonth = string;

function toMonthKey(year: number, monthIndex: number): UtcMonth {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/**
 * `YYYY-MM` → primer y último instante del mes en UTC (020 D4). `to` es el
 * último milisegundo, no el día 1 siguiente: la lección de `last_month` (016).
 * `Date.UTC` normaliza `month = 12` al enero del año siguiente.
 */
export function monthToUtcRange(month: UtcMonth): { from: Date; to: Date } {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 1)),
    to: new Date(Date.UTC(year, monthNumber, 1) - 1),
  };
}

export function currentUtcMonth(now: Date): UtcMonth {
  return toMonthKey(now.getUTCFullYear(), now.getUTCMonth());
}

/** Los últimos `count` meses UTC, del actual hacia atrás (020 D7). */
export function recentUtcMonths(now: Date, count: number): UtcMonth[] {
  const currentIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();

  return Array.from({ length: Math.max(count, 0) }, (_, offset) => {
    const index = currentIndex - offset;
    return toMonthKey(Math.floor(index / 12), index % 12);
  });
}
