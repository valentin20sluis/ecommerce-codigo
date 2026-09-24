/**
 * Lógica pura de fechas de los egresos recurrentes (017). Sin imports: corre
 * bajo `node --test`. Todas las fechas son `YYYY-MM-DD` en UTC, comparables
 * como texto.
 */

/** Tope de relleno hacia atrás (017 D8): ~5 años = 60 vencimientos mensuales. */
export const MAX_BACKFILL_DAYS = 1826;

export type RecurrenceWindow = { dayOfMonth: number; startsOn: string; endsOn: string | null };

export function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `month` es 1–12. En meses más cortos el día se ajusta al último (017 D4). */
export function occurrenceDate(year: number, month: number, dayOfMonth: number): string {
  const day = Math.min(dayOfMonth, daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Vencimientos en `[startsOn, min(endsOn, until)]`, ascendentes. */
function occurrencesUntil(window: RecurrenceWindow, until: string): string[] {
  const last = window.endsOn !== null && window.endsOn < until ? window.endsOn : until;
  const start = parseDate(window.startsOn);
  const dates: string[] = [];

  let year = start.year;
  let month = start.month;

  for (;;) {
    const date = occurrenceDate(year, month, window.dayOfMonth);
    if (date > last) break;
    if (date >= window.startsOn) dates.push(date);

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return dates;
}

/**
 * Vencimientos que faltan por materializar: posteriores a la marca
 * `generatedThrough` y hasta hoy (017 D5/D6). Mirar la marca y no las filas
 * existentes es lo que impide que un egreso borrado reaparezca.
 */
export function dueOccurrences(
  window: RecurrenceWindow & { generatedThrough: string | null },
  today: string,
): string[] {
  return occurrencesUntil(window, today).filter(
    (date) => window.generatedThrough === null || date > window.generatedThrough,
  );
}

/** Último vencimiento ≤ hoy: la marca a la que se adelanta una plantilla reactivada (017 D7). */
export function lastOccurrenceOnOrBefore(window: RecurrenceWindow, today: string): string | null {
  const dates = occurrencesUntil(window, today);
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

/** Próximo vencimiento estrictamente posterior a hoy, o `null` si está pausada o terminó. */
export function nextDueOn(
  window: RecurrenceWindow & { isActive: boolean },
  today: string,
): string | null {
  if (!window.isActive) return null;

  const from = parseDate(window.startsOn > today ? window.startsOn : today);
  let year = from.year;
  let month = from.month;

  // Como mucho hacen falta dos meses: el de partida puede quedar antes de
  // `startsOn` o no ser posterior a hoy.
  for (let step = 0; step < 3; step++) {
    const date = occurrenceDate(year, month, window.dayOfMonth);

    if (date > today && date >= window.startsOn) {
      return window.endsOn !== null && date > window.endsOn ? null : date;
    }

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return null;
}

/** Fecha de inicio más antigua permitida (017 D8). */
export function minStartsOn(today: string): string {
  const { year, month, day } = parseDate(today);
  return toUtcDateString(new Date(Date.UTC(year, month - 1, day - MAX_BACKFILL_DAYS)));
}
