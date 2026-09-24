# Finanzas — Fase 3: Egresos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar egresos operativos (CRUD con auditoría) y plantillas mensuales que generan sus egresos solas, de forma idempotente, al consultar; con página `/admin/finance/expenses`.

**Architecture:** Dos tablas nuevas (`expenses`, `recurring_expenses`) y un enum fijo de categorías. Lógica de fechas recurrentes pura y testeable en `src/modules/finance/recurring.ts`. La generación (`ensureRecurringExpenses`) corre en una transacción con `FOR UPDATE SKIP LOCKED` + `ON CONFLICT DO NOTHING`, y avanza una marca `generated_through` por plantilla (un egreso borrado no reaparece). UI calcada de los patrones de inventario/ingresos, con `Tabs`.

**Tech Stack:** Next.js 16 · Drizzle/Neon · Zod 4 · TanStack Query v5 · TanStack Table · React Hook Form · shadcn (`tabs`, `alert-dialog`, `dialog`, `select`, `field`, `badge`) · Node test runner.

**Spec:** `docs/specs/017-finance-expenses.md`

## Global Constraints

- Montos en centavos enteros (`amount_cents`, `CHECK > 0`), nunca `float`. Tope `MAX_EXPENSE_CENTS = 99_999_999` en Zod.
- TypeScript estricto: cero `any`, cero `@ts-ignore`, **sin casts que desactiven chequeos** (lección 016 I2).
- Ningún archivo que corra bajo `node --test` importa un **valor** vía alias `@/` (solo `import type`). Usar imports relativos con extensión `.ts` (precedente: `src/server/services/user-projection.ts`, `modules/finance/types/revenue.ts`). Aplica a `recurring.ts`, `expense-range.ts`, `expense.schema.ts`, `types/expense.ts` y a sus tests.
- Fechas de negocio en UTC; `incurred_on`/`starts_on`/`ends_on`/`generated_through` son `date` (Drizzle `mode: "string"`, formato `YYYY-MM-DD`). Rango del listado ≤ 1826 días (`MAX_EXPENSE_RANGE_DAYS`).
- Un componente nunca importa `db`/Drizzle/repositorio ni llama `axios` directo (servicio → hook). Toda consulta en `src/server/repositories/`. Todo Route Handler valida con Zod antes de tocar datos.
- Autorización siempre por `requirePermission(PERMISSIONS.*)`; nunca por nombre de rol. `audit_logs` en la misma transacción que la mutación; el borrado guarda la foto completa en `changes.before`.
- Gestor de paquetes npm. Verificación final: `npm run typecheck && npm run lint && npm run build && npm test`.
- Aplicar la migración a Neon (`npm run db:migrate`) y sembrar permisos (`npm run db:seed`) son acciones sobre la BD real: **pedir confirmación al usuario antes** (Task 13).

## Review Focus

- Un egreso generado que se borra **no reaparece** al volver a consultar (AC9) — pinneado en Task 3 (`dueOccurrences` respeta la marca) y verificado contra BD real en Task 13.
- Generación ejecutada dos veces seguidas o **en paralelo** no duplica vencimientos (AC8) — Task 13 (script contra BD real con `Promise.all`); el candado es el índice único + `ON CONFLICT DO NOTHING` de Task 1/7.
- Plantilla con `day_of_month` 29–31 en meses cortos (y febrero bisiesto) cae en el último día del mes — Task 3.
- Reactivar una plantilla pausada **no** genera el período en pausa (AC11) — Task 3 (`lastOccurrenceOnOrBefore`) y Task 13.
- Rango libre elegido en una zona horaria al este de UTC no debe correr el día (`from`/`to` se convierten a fecha **local** del calendario, no al slice UTC) — Task 6.

---

### Task 1: Esquema y migración

**Files:**
- Create: `src/server/db/schema/expense-category.ts`
- Create: `src/server/db/schema/recurring-expense.ts`
- Create: `src/server/db/schema/expense.ts`
- Modify: `src/server/db/schema/index.ts`
- Create: `drizzle/0011_*.sql` (lo genera `drizzle-kit`)

**Interfaces:**
- Consumes: `users` (`./user`).
- Produces: `EXPENSE_CATEGORIES`, `ExpenseCategory`, `expenseCategory` (enum), tablas `expenses` y `recurringExpenses`, tipos `Expense`, `NewExpense`, `RecurringExpense`, `NewRecurringExpense`.

- [ ] **Step 1: Confirmar árbol limpio**

Run: `git status --short`
Expected: sin salida (solo así `git add drizzle/` del Step 6 es seguro).

- [ ] **Step 2: Enum de categorías (archivo propio para evitar ciclo de imports)**

Crea `src/server/db/schema/expense-category.ts`:

```ts
import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Categorías fijas de egreso (017 D2). Agregar una es un cambio de código más
 * una migración aditiva (`ALTER TYPE … ADD VALUE`). La lista se duplica a
 * propósito en `modules/finance/schemas/expense.schema.ts` (lo importan
 * componentes cliente); `expense.service.ts` fija la sincronía en compilación.
 */
export const EXPENSE_CATEGORIES = [
  "advertising",
  "payroll",
  "rent",
  "software",
  "shipping",
  "payment_fees",
  "taxes_fees",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseCategory = pgEnum("expense_category", EXPENSE_CATEGORIES);
```

- [ ] **Step 3: Tabla `recurring_expenses`**

Crea `src/server/db/schema/recurring-expense.ts`:

```ts
import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { boolean, check, date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { expenseCategory } from "./expense-category";
import { users } from "./user";

export const recurringExpenses = pgTable(
  "recurring_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: expenseCategory("category").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** 1–31; en meses más cortos el vencimiento cae en el último día (017 D4). */
    dayOfMonth: integer("day_of_month").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }),
    isActive: boolean("is_active").notNull().default(true),
    /**
     * Fecha del último vencimiento materializado (017 D6). Es la fuente de
     * verdad del avance: un egreso generado que se borra no reaparece porque
     * la generación solo mira lo posterior a esta marca.
     */
    generatedThrough: date("generated_through", { mode: "string" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("recurring_expenses_amount_positive", sql`${t.amountCents} > 0`),
    check("recurring_expenses_day_of_month_range", sql`${t.dayOfMonth} between 1 and 31`),
    check(
      "recurring_expenses_ends_after_starts",
      sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`,
    ),
  ],
);

export type RecurringExpense = InferSelectModel<typeof recurringExpenses>;
export type NewRecurringExpense = InferInsertModel<typeof recurringExpenses>;
```

- [ ] **Step 4: Tabla `expenses`**

Crea `src/server/db/schema/expense.ts`:

```ts
import { desc, sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { expenseCategory } from "./expense-category";
import { recurringExpenses } from "./recurring-expense";
import { users } from "./user";

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: expenseCategory("category").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** Día del gasto, sin hora: evita cualquier corrimiento por zona horaria (017 D9). */
    incurredOn: date("incurred_on", { mode: "string" }).notNull(),
    // SET NULL: borrar la plantilla conserva los egresos ya generados (017 D7).
    recurringExpenseId: uuid("recurring_expense_id").references(() => recurringExpenses.id, {
      onDelete: "set null",
    }),
    // Nulo = generado por el sistema, o autor dado de baja.
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("expenses_incurred_on_idx").on(desc(t.incurredOn)),
    index("expenses_category_incurred_on_idx").on(t.category, desc(t.incurredOn)),
    // Candado contra ejecuciones concurrentes de la generación (017 D6).
    uniqueIndex("expenses_recurring_occurrence_unique")
      .on(t.recurringExpenseId, t.incurredOn)
      .where(sql`${t.recurringExpenseId} is not null`),
    check("expenses_amount_positive", sql`${t.amountCents} > 0`),
  ],
);

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;
```

- [ ] **Step 5: Barrel**

En `src/server/db/schema/index.ts`, agrega tres líneas manteniendo el orden alfabético:

```ts
export * from "./audit-log";
export * from "./category";
export * from "./expense";
export * from "./expense-category";
export * from "./order";
export * from "./order-item";
export * from "./payment-method";
export * from "./permission";
export * from "./product";
export * from "./recurring-expense";
export * from "./role";
export * from "./role-permission";
export * from "./stock-movement";
export * from "./user";
export * from "./user-role";
```

- [ ] **Step 6: Generar la migración y verificar**

Run: `npm run db:generate`
Expected: crea `drizzle/0011_<nombre>.sql` con `CREATE TYPE "public"."expense_category"`, `CREATE TABLE "recurring_expenses"`, `CREATE TABLE "expenses"`, los `CHECK`, las FKs (`ON DELETE set null`), los índices y el índice único parcial `WHERE "expenses"."recurring_expense_id" is not null`. Léelo: no debe haber `DROP` ni `ALTER` de tablas existentes.

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/server/db/schema/ drizzle/
git commit -m "feat(finance): add expenses and recurring_expenses schema and migration"
```

---

### Task 2: Permiso `finance.manage_expenses`

**Files:**
- Modify: `src/lib/permissions.catalog.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `PERMISSIONS.FINANCE_MANAGE_EXPENSES: "finance.manage_expenses"`.

- [ ] **Step 1: Agregar el código y su descripción**

En `src/lib/permissions.catalog.ts`, tras `FINANCE_MANAGE_COSTS` en `PERMISSIONS`:

```ts
  FINANCE_READ: "finance.read",
  FINANCE_MANAGE_COSTS: "finance.manage_costs",
  FINANCE_MANAGE_EXPENSES: "finance.manage_expenses",
```

Y en `PERMISSION_DESCRIPTIONS`, tras la de `FINANCE_MANAGE_COSTS`:

```ts
  [PERMISSIONS.FINANCE_MANAGE_EXPENSES]:
    "Crear, editar y borrar egresos y plantillas de egresos recurrentes.",
```

`super_admin` y `admin` lo reciben solos vía `ALL_PERMISSIONS`; `manager`, `audit` y `employee` no se tocan (017 D10: `manager`/`audit` solo tienen `finance.read`).

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores (`PERMISSION_DESCRIPTIONS` es un `Record<PermissionCode, string>`: olvidar la descripción sería error de compilación).

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.catalog.ts
git commit -m "feat(finance): add finance.manage_expenses permission"
```

---

### Task 3: Funciones puras de recurrencia y de importes (TDD)

**Files:**
- Create: `src/modules/finance/recurring.ts`
- Test: `src/modules/finance/recurring.test.ts`
- Modify: `src/modules/finance/utils.ts`
- Modify: `src/modules/finance/utils.test.ts`

**Interfaces:**
- Consumes: nada (ambos archivos sin imports).
- Produces (`recurring.ts`): `MAX_BACKFILL_DAYS: 1826`; `toUtcDateString(date: Date): string`; `occurrenceDate(year: number, month: number, dayOfMonth: number): string` (`month` 1–12); `type RecurrenceWindow = { dayOfMonth: number; startsOn: string; endsOn: string | null }`; `dueOccurrences(w: RecurrenceWindow & { generatedThrough: string | null }, today: string): string[]`; `lastOccurrenceOnOrBefore(w: RecurrenceWindow, today: string): string | null`; `nextDueOn(w: RecurrenceWindow & { isActive: boolean }, today: string): string | null`; `minStartsOn(today: string): string`. Produces (`utils.ts`): `parseAmountToCents(value: string): number`.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `src/modules/finance/recurring.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dueOccurrences,
  lastOccurrenceOnOrBefore,
  minStartsOn,
  nextDueOn,
  occurrenceDate,
  toUtcDateString,
} from "./recurring.ts";

describe("toUtcDateString", () => {
  it("returns the UTC calendar day", () => {
    assert.equal(toUtcDateString(new Date(Date.UTC(2026, 2, 5, 23, 59))), "2026-03-05");
  });
});

describe("occurrenceDate", () => {
  it("keeps a day that exists in the month", () => {
    assert.equal(occurrenceDate(2026, 3, 5), "2026-03-05");
  });

  it("clamps day 31 to the last day of a 30-day month", () => {
    assert.equal(occurrenceDate(2026, 4, 31), "2026-04-30");
  });

  it("clamps day 31 to Feb 28 in a common year", () => {
    assert.equal(occurrenceDate(2026, 2, 31), "2026-02-28");
  });

  it("clamps day 31 to Feb 29 in a leap year", () => {
    assert.equal(occurrenceDate(2028, 2, 31), "2028-02-29");
  });
});

describe("dueOccurrences", () => {
  const monthEnd = { dayOfMonth: 31, startsOn: "2026-01-31", endsOn: null, generatedThrough: null };

  it("generates every occurrence from the start up to today, clamped in short months", () => {
    assert.deepEqual(dueOccurrences(monthEnd, "2026-04-15"), [
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("only returns what is after the watermark", () => {
    assert.deepEqual(dueOccurrences({ ...monthEnd, generatedThrough: "2026-02-28" }, "2026-04-15"), [
      "2026-03-31",
    ]);
  });

  it("does not regenerate anything at or before the watermark (a deleted occurrence stays deleted)", () => {
    assert.deepEqual(dueOccurrences({ ...monthEnd, generatedThrough: "2026-03-31" }, "2026-04-15"), []);
  });

  it("is idempotent: after generating up to the last date, nothing is due", () => {
    const first = dueOccurrences(monthEnd, "2026-04-15");
    const wm = first[first.length - 1];
    assert.deepEqual(dueOccurrences({ ...monthEnd, generatedThrough: wm }, "2026-04-15"), []);
  });

  it("stops at endsOn", () => {
    assert.deepEqual(dueOccurrences({ ...monthEnd, endsOn: "2026-02-28" }, "2026-04-15"), [
      "2026-01-31",
      "2026-02-28",
    ]);
  });

  it("skips the first month's occurrence when it falls before startsOn", () => {
    const w = { dayOfMonth: 5, startsOn: "2026-03-20", endsOn: null, generatedThrough: null };

    assert.deepEqual(dueOccurrences(w, "2026-05-10"), ["2026-04-05", "2026-05-05"]);
  });

  it("returns nothing when today is before the start", () => {
    const w = { dayOfMonth: 1, startsOn: "2026-06-01", endsOn: null, generatedThrough: null };

    assert.deepEqual(dueOccurrences(w, "2026-05-01"), []);
  });

  it("includes an occurrence that falls exactly on today", () => {
    const w = { dayOfMonth: 15, startsOn: "2026-03-01", endsOn: null, generatedThrough: null };

    assert.deepEqual(dueOccurrences(w, "2026-03-15"), ["2026-03-15"]);
  });
});

describe("lastOccurrenceOnOrBefore", () => {
  const w = { dayOfMonth: 5, startsOn: "2026-01-01", endsOn: null };

  it("returns this month's occurrence once it has passed", () => {
    assert.equal(lastOccurrenceOnOrBefore(w, "2026-03-10"), "2026-03-05");
  });

  it("returns last month's occurrence when this month's has not happened yet", () => {
    assert.equal(lastOccurrenceOnOrBefore(w, "2026-03-04"), "2026-02-05");
  });

  it("returns null when nothing has happened yet", () => {
    assert.equal(lastOccurrenceOnOrBefore({ ...w, startsOn: "2026-06-01" }, "2026-03-04"), null);
  });
});

describe("nextDueOn", () => {
  const w = { dayOfMonth: 15, startsOn: "2026-01-01", endsOn: null, isActive: true };

  it("returns this month's occurrence when it is still ahead", () => {
    assert.equal(nextDueOn(w, "2026-03-10"), "2026-03-15");
  });

  it("is strictly after today", () => {
    assert.equal(nextDueOn(w, "2026-03-15"), "2026-04-15");
  });

  it("returns null when the template has ended", () => {
    assert.equal(nextDueOn({ ...w, endsOn: "2026-03-01" }, "2026-03-10"), null);
  });

  it("returns null when the template is paused", () => {
    assert.equal(nextDueOn({ ...w, isActive: false }, "2026-03-10"), null);
  });

  it("starts at the first valid occurrence when startsOn is in the future", () => {
    const future = { dayOfMonth: 5, startsOn: "2026-06-20", endsOn: null, isActive: true };

    assert.equal(nextDueOn(future, "2026-03-01"), "2026-07-05");
  });

  it("clamps day 31 into a short month", () => {
    const monthEnd = { dayOfMonth: 31, startsOn: "2026-01-01", endsOn: null, isActive: true };

    assert.equal(nextDueOn(monthEnd, "2026-01-31"), "2026-02-28");
  });
});

describe("minStartsOn", () => {
  it("is exactly 1826 days before today", () => {
    assert.equal(minStartsOn("2026-09-24"), "2021-09-24");
  });
});
```

Agrega al final de `src/modules/finance/utils.test.ts`, y suma `parseAmountToCents` al import existente (`import { computeMargin, fillMissingDaysInRange, parseAmountToCents, resolveDateRangePreset, resolveMarginCoverage } from "./utils.ts";`):

```ts
describe("parseAmountToCents", () => {
  it("converts a dot decimal to integer cents", () => {
    assert.equal(parseAmountToCents("19.99"), 1999);
  });

  it("converts a comma decimal to integer cents", () => {
    assert.equal(parseAmountToCents("19,99"), 1999);
  });

  it("rounds away floating point noise", () => {
    assert.equal(parseAmountToCents("0.1"), 10);
  });

  it("returns NaN for text that is not a number", () => {
    assert.ok(Number.isNaN(parseAmountToCents("abc")));
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que fallan**

Run: `node --test "src/modules/finance/recurring.test.ts" "src/modules/finance/utils.test.ts"`
Expected: FAIL — `./recurring.ts` no existe y `utils.ts` no exporta `parseAmountToCents`.

- [ ] **Step 3: Implementar `recurring.ts`**

Crea `src/modules/finance/recurring.ts`:

```ts
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
```

- [ ] **Step 4: Implementar `parseAmountToCents`**

Agrega al final de `src/modules/finance/utils.ts`:

```ts
/**
 * "19.99" → 1999, misma fórmula que `toCents` de `@/lib/utils`, reimplementada
 * aquí porque los schemas de formulario corren bajo `node --test`, que no
 * resuelve imports de valor por alias `@/`. Devuelve `NaN` si no es número.
 */
export function parseAmountToCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}
```

- [ ] **Step 5: Ejecutar y confirmar que pasan**

Run: `node --test "src/modules/finance/recurring.test.ts" "src/modules/finance/utils.test.ts"`
Expected: PASS (`recurring.test.ts`: 23 tests; `utils.test.ts`: 23).

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/recurring.ts src/modules/finance/recurring.test.ts src/modules/finance/utils.ts src/modules/finance/utils.test.ts
git commit -m "feat(finance): add recurrence date logic and amount parsing with tests"
```

---

### Task 4: Schemas Zod (TDD)

**Files:**
- Create: `src/modules/finance/schemas/expense.schema.ts`
- Test: `src/modules/finance/schemas/expense.schema.test.ts`

**Interfaces:**
- Consumes: `parseAmountToCents` (`../utils.ts`); `revenueFiltersSchema` (`./revenue.schema.ts`) — ambos con import **relativo**.
- Produces: `EXPENSE_CATEGORY_VALUES`, `ExpenseCategoryValue`, `MAX_EXPENSE_CENTS`, `MAX_EXPENSE_RANGE_DAYS`; `createExpenseSchema`/`CreateExpenseInput`, `updateExpenseSchema`/`UpdateExpenseInput`, `expensesQuerySchema`/`ExpensesQuery`; `createRecurringExpenseSchema`/`CreateRecurringExpenseInput`, `updateRecurringExpenseSchema`/`UpdateRecurringExpenseInput`; `expenseFiltersSchema`/`ExpenseFilters`; formularios `expenseFormSchema`/`ExpenseFormValues`, `recurringFormSchema`/`RecurringFormValues`, y conversores `toCreateExpenseInput(values)`, `toCreateRecurringInput(values)`, `toUpdateRecurringInput(values)`.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/modules/finance/schemas/expense.schema.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createExpenseSchema,
  createRecurringExpenseSchema,
  expenseFormSchema,
  expensesQuerySchema,
  recurringFormSchema,
  toCreateExpenseInput,
  toCreateRecurringInput,
  toUpdateRecurringInput,
  updateExpenseSchema,
  updateRecurringExpenseSchema,
} from "./expense.schema.ts";

const validExpense = {
  category: "rent",
  description: "Alquiler marzo",
  amountCents: 150000,
  incurredOn: "2026-03-01",
};

describe("createExpenseSchema", () => {
  it("accepts a valid expense", () => {
    assert.equal(createExpenseSchema.safeParse(validExpense).success, true);
  });

  it("rejects a zero amount", () => {
    assert.equal(createExpenseSchema.safeParse({ ...validExpense, amountCents: 0 }).success, false);
  });

  it("rejects an amount above the ceiling (would overflow int4 into a 500)", () => {
    assert.equal(
      createExpenseSchema.safeParse({ ...validExpense, amountCents: 100_000_000 }).success,
      false,
    );
  });

  it("rejects a fractional amount", () => {
    assert.equal(createExpenseSchema.safeParse({ ...validExpense, amountCents: 10.5 }).success, false);
  });

  it("rejects an unknown category", () => {
    assert.equal(createExpenseSchema.safeParse({ ...validExpense, category: "food" }).success, false);
  });

  it("rejects a one-character description", () => {
    assert.equal(createExpenseSchema.safeParse({ ...validExpense, description: "a" }).success, false);
  });

  it("rejects a datetime where a plain date is expected", () => {
    assert.equal(
      createExpenseSchema.safeParse({ ...validExpense, incurredOn: "2026-03-01T00:00:00.000Z" }).success,
      false,
    );
  });
});

describe("updateExpenseSchema", () => {
  it("accepts a partial update", () => {
    assert.equal(updateExpenseSchema.safeParse({ amountCents: 200000 }).success, true);
  });

  it("rejects an empty update", () => {
    assert.equal(updateExpenseSchema.safeParse({}).success, false);
  });
});

describe("expensesQuerySchema", () => {
  it("applies pagination defaults", () => {
    const result = expensesQuerySchema.safeParse({ from: "2026-03-01", to: "2026-03-31" });
    assert.equal(result.success, true);
    assert.equal(result.data?.page, 1);
    assert.equal(result.data?.pageSize, 20);
  });

  it("rejects to before from", () => {
    assert.equal(expensesQuerySchema.safeParse({ from: "2026-03-31", to: "2026-03-01" }).success, false);
  });

  it("accepts a span right at the 1826-day cap", () => {
    assert.equal(expensesQuerySchema.safeParse({ from: "2021-01-01", to: "2026-01-01" }).success, true);
  });

  it("rejects a span above the cap", () => {
    assert.equal(expensesQuerySchema.safeParse({ from: "2000-01-01", to: "2026-01-01" }).success, false);
  });

  it("rejects an unknown category filter", () => {
    assert.equal(
      expensesQuerySchema.safeParse({ from: "2026-03-01", to: "2026-03-31", category: "food" }).success,
      false,
    );
  });
});

describe("createRecurringExpenseSchema", () => {
  const valid = { ...validExpense, dayOfMonth: 31, startsOn: "2026-01-31" };

  it("accepts a valid template", () => {
    assert.equal(
      createRecurringExpenseSchema.safeParse({ category: valid.category, description: valid.description, amountCents: valid.amountCents, dayOfMonth: 31, startsOn: valid.startsOn }).success,
      true,
    );
  });

  it("rejects day 32", () => {
    assert.equal(
      createRecurringExpenseSchema.safeParse({ category: "rent", description: "Alquiler", amountCents: 100, dayOfMonth: 32, startsOn: "2026-01-01" }).success,
      false,
    );
  });

  it("rejects endsOn before startsOn", () => {
    assert.equal(
      createRecurringExpenseSchema.safeParse({ category: "rent", description: "Alquiler", amountCents: 100, dayOfMonth: 5, startsOn: "2026-03-01", endsOn: "2026-02-01" }).success,
      false,
    );
  });
});

describe("updateRecurringExpenseSchema", () => {
  it("accepts pausing a template", () => {
    assert.equal(updateRecurringExpenseSchema.safeParse({ isActive: false }).success, true);
  });

  it("accepts clearing endsOn with null", () => {
    assert.equal(updateRecurringExpenseSchema.safeParse({ endsOn: null }).success, true);
  });

  it("rejects startsOn (not editable, 017 D7)", () => {
    assert.equal(updateRecurringExpenseSchema.safeParse({ startsOn: "2026-01-01" }).success, false);
  });

  it("rejects an empty update", () => {
    assert.equal(updateRecurringExpenseSchema.safeParse({}).success, false);
  });
});

describe("expenseFormSchema / toCreateExpenseInput", () => {
  const form = { category: "rent" as const, description: "Alquiler", amount: "1500,50", incurredOn: "2026-03-01" };

  it("converts a comma decimal into integer cents", () => {
    const parsed = expenseFormSchema.parse(form);
    assert.deepEqual(toCreateExpenseInput(parsed), {
      category: "rent",
      description: "Alquiler",
      amountCents: 150050,
      incurredOn: "2026-03-01",
    });
  });

  it("rejects a zero amount in the form", () => {
    assert.equal(expenseFormSchema.safeParse({ ...form, amount: "0" }).success, false);
  });

  it("rejects an amount above the ceiling in the form", () => {
    assert.equal(expenseFormSchema.safeParse({ ...form, amount: "1000000.00" }).success, false);
  });

  it("rejects text as an amount", () => {
    assert.equal(expenseFormSchema.safeParse({ ...form, amount: "abc" }).success, false);
  });
});

describe("recurringFormSchema / converters", () => {
  const form = {
    category: "software" as const,
    description: "Hosting",
    amount: "20",
    dayOfMonth: "31",
    startsOn: "2026-01-31",
    endsOn: "",
    isActive: true,
  };

  it("builds a create input with a null-less endsOn when empty", () => {
    const parsed = recurringFormSchema.parse(form);
    assert.deepEqual(toCreateRecurringInput(parsed), {
      category: "software",
      description: "Hosting",
      amountCents: 2000,
      dayOfMonth: 31,
      startsOn: "2026-01-31",
      endsOn: null,
    });
  });

  it("builds an update input without startsOn and with endsOn null when empty", () => {
    const parsed = recurringFormSchema.parse(form);
    assert.deepEqual(toUpdateRecurringInput(parsed), {
      category: "software",
      description: "Hosting",
      amountCents: 2000,
      dayOfMonth: 31,
      endsOn: null,
      isActive: true,
    });
  });

  it("rejects a day of month outside 1-31", () => {
    assert.equal(recurringFormSchema.safeParse({ ...form, dayOfMonth: "0" }).success, false);
    assert.equal(recurringFormSchema.safeParse({ ...form, dayOfMonth: "32" }).success, false);
  });

  it("rejects an end date before the start date", () => {
    assert.equal(recurringFormSchema.safeParse({ ...form, endsOn: "2026-01-01" }).success, false);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `node --test "src/modules/finance/schemas/expense.schema.test.ts"`
Expected: FAIL — `Cannot find module './expense.schema.ts'`.

- [ ] **Step 3: Implementar**

Crea `src/modules/finance/schemas/expense.schema.ts`:

```ts
import { z } from "zod";

import { parseAmountToCents } from "../utils.ts";
import { revenueFiltersSchema } from "./revenue.schema.ts";

/**
 * Duplicado a propósito de `EXPENSE_CATEGORIES` (`server/db/schema/expense-category.ts`):
 * este archivo lo importan componentes cliente y no puede depender de
 * `server/`. La sincronía la fija en compilación `expense.service.ts`.
 */
export const EXPENSE_CATEGORY_VALUES = [
  "advertising",
  "payroll",
  "rent",
  "software",
  "shipping",
  "payment_fees",
  "taxes_fees",
  "other",
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORY_VALUES)[number];

/** Tope de cordura: por encima del rango `int4` de Postgres el INSERT daría un 500 opaco. */
export const MAX_EXPENSE_CENTS = 99_999_999;

/** Mismo tope de rango que el reporte de ingresos (016 I3). */
export const MAX_EXPENSE_RANGE_DAYS = 1826;

const categorySchema = z.enum(EXPENSE_CATEGORY_VALUES);
const descriptionSchema = z.string().trim().min(2, "Mínimo 2 caracteres.").max(200);
const amountCentsSchema = z.number().int().min(1).max(MAX_EXPENSE_CENTS);
const dateSchema = z.iso.date("Elige una fecha válida.");

function nonEmpty(value: object): boolean {
  return Object.keys(value).length > 0;
}

export const createExpenseSchema = z.object({
  category: categorySchema,
  description: descriptionSchema,
  amountCents: amountCentsSchema,
  incurredOn: dateSchema,
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z
  .strictObject({
    category: categorySchema.optional(),
    description: descriptionSchema.optional(),
    amountCents: amountCentsSchema.optional(),
    incurredOn: dateSchema.optional(),
  })
  .refine(nonEmpty, "No hay nada que actualizar.");

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const expensesQuerySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    category: categorySchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((values, ctx) => {
    if (values.to < values.from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "El fin del rango no puede ser anterior al inicio.",
      });
      return;
    }

    const spanDays = (Date.parse(values.to) - Date.parse(values.from)) / 86_400_000;
    if (spanDays > MAX_EXPENSE_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `El rango no puede superar ${MAX_EXPENSE_RANGE_DAYS} días.`,
      });
    }
  });

export type ExpensesQuery = z.infer<typeof expensesQuerySchema>;

export const createRecurringExpenseSchema = z
  .object({
    category: categorySchema,
    description: descriptionSchema,
    amountCents: amountCentsSchema,
    dayOfMonth: z.number().int().min(1).max(31),
    startsOn: dateSchema,
    endsOn: dateSchema.nullish(),
  })
  .superRefine((values, ctx) => {
    if (values.endsOn && values.endsOn < values.startsOn) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "La fecha de fin no puede ser anterior a la de inicio.",
      });
    }
  });

export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;

/** Sin `startsOn` (017 D7): `strictObject` lo rechaza con 400 en vez de ignorarlo en silencio. */
export const updateRecurringExpenseSchema = z
  .strictObject({
    category: categorySchema.optional(),
    description: descriptionSchema.optional(),
    amountCents: amountCentsSchema.optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    endsOn: dateSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(nonEmpty, "No hay nada que actualizar.");

export type UpdateRecurringExpenseInput = z.infer<typeof updateRecurringExpenseSchema>;

/** Filtros del listado tal como viajan en la URL: rango de Ingresos + categoría + página. */
export const expenseFiltersSchema = revenueFiltersSchema.extend({
  category: categorySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;

const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;

const amountTextSchema = z.string().trim().regex(AMOUNT_PATTERN, "Usa un número con hasta dos decimales.");

function checkAmount(amount: string, ctx: z.RefinementCtx): void {
  const cents = parseAmountToCents(amount);

  if (Number.isFinite(cents) && (cents < 1 || cents > MAX_EXPENSE_CENTS)) {
    ctx.addIssue({
      code: "custom",
      path: ["amount"],
      message: `El monto debe estar entre 0.01 y ${(MAX_EXPENSE_CENTS / 100).toFixed(2)}.`,
    });
  }
}

/** El formulario captura el monto como texto ("1500,50"); la API recibe centavos. */
export const expenseFormSchema = z
  .object({
    category: categorySchema,
    description: descriptionSchema,
    amount: amountTextSchema,
    incurredOn: dateSchema,
  })
  .superRefine((values, ctx) => checkAmount(values.amount, ctx));

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function toCreateExpenseInput(values: ExpenseFormValues): CreateExpenseInput {
  return createExpenseSchema.parse({
    category: values.category,
    description: values.description,
    amountCents: parseAmountToCents(values.amount),
    incurredOn: values.incurredOn,
  });
}

export const recurringFormSchema = z
  .object({
    category: categorySchema,
    description: descriptionSchema,
    amount: amountTextSchema,
    dayOfMonth: z.string().trim().regex(/^\d{1,2}$/, "Un día entre 1 y 31."),
    startsOn: dateSchema,
    endsOn: z.union([z.literal(""), dateSchema]),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    checkAmount(values.amount, ctx);

    const day = Number.parseInt(values.dayOfMonth, 10);
    if (day < 1 || day > 31) {
      ctx.addIssue({ code: "custom", path: ["dayOfMonth"], message: "Un día entre 1 y 31." });
    }

    if (values.endsOn !== "" && values.endsOn < values.startsOn) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "La fecha de fin no puede ser anterior a la de inicio.",
      });
    }
  });

export type RecurringFormValues = z.infer<typeof recurringFormSchema>;

export function toCreateRecurringInput(values: RecurringFormValues): CreateRecurringExpenseInput {
  return createRecurringExpenseSchema.parse({
    category: values.category,
    description: values.description,
    amountCents: parseAmountToCents(values.amount),
    dayOfMonth: Number.parseInt(values.dayOfMonth, 10),
    startsOn: values.startsOn,
    endsOn: values.endsOn === "" ? null : values.endsOn,
  });
}

export function toUpdateRecurringInput(values: RecurringFormValues): UpdateRecurringExpenseInput {
  return updateRecurringExpenseSchema.parse({
    category: values.category,
    description: values.description,
    amountCents: parseAmountToCents(values.amount),
    dayOfMonth: Number.parseInt(values.dayOfMonth, 10),
    endsOn: values.endsOn === "" ? null : values.endsOn,
    isActive: values.isActive,
  });
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `node --test "src/modules/finance/schemas/expense.schema.test.ts"`
Expected: PASS, 29/29.

- [ ] **Step 5: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/schemas/expense.schema.ts src/modules/finance/schemas/expense.schema.test.ts
git commit -m "feat(finance): add expense and recurring expense Zod schemas"
```

---

### Task 5: DTOs, etiquetas y resolución de rango (TDD)

**Files:**
- Create: `src/modules/finance/types/expense.ts`
- Test: `src/modules/finance/types/expense.test.ts`
- Create: `src/modules/finance/expense-range.ts`
- Test: `src/modules/finance/expense-range.test.ts`
- Create: `src/modules/finance/constants.ts`

**Interfaces:**
- Consumes: `nextDueOn` (`../recurring.ts`); `resolveDateRangePreset` (`./utils.ts`); tipos `Expense`, `RecurringExpense` (`@/server/db/schema`, solo `import type`); `ExpenseCategoryValue` (Task 4, `import type`).
- Produces: `ExpenseDto`, `ExpenseListResponse`, `RecurringExpenseDto`, `toExpenseDto(row)`, `toRecurringExpenseDto(row, today)`; `toLocalDateString(iso: string): string`, `resolveExpenseRange(filters, now?): { from: string; to: string } | null`; `EXPENSE_CATEGORY_LABEL`, `formatDateOnly(value: string)`.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `src/modules/finance/types/expense.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toExpenseDto, toRecurringExpenseDto } from "./expense.ts";

describe("toExpenseDto", () => {
  it("keeps the client-facing fields and drops audit columns", () => {
    const dto = toExpenseDto({
      id: "e1",
      category: "rent",
      description: "Alquiler",
      amountCents: 150000,
      incurredOn: "2026-03-01",
      recurringExpenseId: null,
      createdBy: "u1",
      createdAt: new Date("2026-03-01T10:00:00Z"),
      updatedAt: new Date("2026-03-01T10:00:00Z"),
    });

    assert.deepEqual(dto, {
      id: "e1",
      category: "rent",
      description: "Alquiler",
      amountCents: 150000,
      incurredOn: "2026-03-01",
      recurringExpenseId: null,
    });
  });
});

describe("toRecurringExpenseDto", () => {
  const row = {
    id: "r1",
    category: "software" as const,
    description: "Hosting",
    amountCents: 2000,
    dayOfMonth: 15,
    startsOn: "2026-01-01",
    endsOn: null,
    isActive: true,
    generatedThrough: "2026-03-15",
    createdBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  it("derives the next due date and hides the watermark", () => {
    const dto = toRecurringExpenseDto(row, "2026-03-20");

    assert.equal(dto.nextDueOn, "2026-04-15");
    assert.equal("generatedThrough" in dto, false);
  });

  it("has no next due date when paused", () => {
    assert.equal(toRecurringExpenseDto({ ...row, isActive: false }, "2026-03-20").nextDueOn, null);
  });
});
```

Crea `src/modules/finance/expense-range.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveExpenseRange, toLocalDateString } from "./expense-range.ts";

describe("toLocalDateString", () => {
  it("returns the local calendar day of an instant, not the UTC slice", () => {
    assert.equal(toLocalDateString(new Date(2026, 2, 1).toISOString()), "2026-03-01");
  });
});

describe("resolveExpenseRange", () => {
  it("resolves 'this_month' from the 1st (UTC) to today", () => {
    const now = new Date(2026, 2, 15, 10, 30);

    assert.deepEqual(resolveExpenseRange({ preset: "this_month" }, now), {
      from: "2026-03-01",
      to: now.toISOString().slice(0, 10),
    });
  });

  it("resolves 'last_month' to the whole previous calendar month", () => {
    assert.deepEqual(resolveExpenseRange({ preset: "last_month" }, new Date(2026, 2, 15)), {
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("uses the LOCAL day of the calendar picks for a custom range (no off-by-one east of UTC)", () => {
    const range = resolveExpenseRange({
      preset: "custom",
      from: new Date(2026, 2, 1).toISOString(),
      to: new Date(2026, 2, 5, 23, 59, 59, 999).toISOString(),
    });

    assert.deepEqual(range, { from: "2026-03-01", to: "2026-03-05" });
  });

  it("returns null for a half-picked custom range", () => {
    assert.equal(
      resolveExpenseRange({ preset: "custom", from: new Date(2026, 2, 1).toISOString() }),
      null,
    );
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que fallan**

Run: `node --test "src/modules/finance/types/expense.test.ts" "src/modules/finance/expense-range.test.ts"`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar los DTOs**

Crea `src/modules/finance/types/expense.ts`:

```ts
// Import relativo a propósito: `node --test` no resuelve valores vía alias `@/`.
import { nextDueOn } from "../recurring.ts";
import type { ExpenseCategoryValue } from "../schemas/expense.schema.ts";
import type { Expense, RecurringExpense } from "@/server/db/schema";
import type { Paginated } from "@/types/api";

export type ExpenseDto = {
  id: string;
  category: ExpenseCategoryValue;
  description: string;
  amountCents: number;
  /** `YYYY-MM-DD`. */
  incurredOn: string;
  /** No nulo = nació de una plantilla. */
  recurringExpenseId: string | null;
};

/** `totalCents` suma todo el filtro, no solo la página (017 AC6). */
export type ExpenseListResponse = Paginated<ExpenseDto> & { totalCents: number };

export type RecurringExpenseDto = {
  id: string;
  category: ExpenseCategoryValue;
  description: string;
  amountCents: number;
  dayOfMonth: number;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  nextDueOn: string | null;
};

export function toExpenseDto(row: Expense): ExpenseDto {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    amountCents: row.amountCents,
    incurredOn: row.incurredOn,
    recurringExpenseId: row.recurringExpenseId,
  };
}

export function toRecurringExpenseDto(row: RecurringExpense, today: string): RecurringExpenseDto {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    amountCents: row.amountCents,
    dayOfMonth: row.dayOfMonth,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    isActive: row.isActive,
    nextDueOn: nextDueOn(row, today),
  };
}
```

- [ ] **Step 4: Implementar la resolución de rango**

Crea `src/modules/finance/expense-range.ts`:

```ts
import { resolveDateRangePreset } from "./utils.ts";

export type ExpenseRange = { from: string; to: string };

type RangeFilters = {
  preset: "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";
  from?: string;
  to?: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Día calendario **local** de un instante: el calendario del selector devuelve fechas locales. */
export function toLocalDateString(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Traduce el filtro a las fechas `YYYY-MM-DD` que espera la API (`incurred_on`
 * es `date`). Los presets ya vienen construidos en UTC (`resolveDateRangePreset`,
 * 016 I1), así que se cortan por UTC; el rango libre trae instantes de un
 * calendario local, así que se lee su día **local** — cortar por UTC correría
 * el día para quien esté al este de UTC+0.
 */
export function resolveExpenseRange(
  filters: RangeFilters,
  now: Date = new Date(),
): ExpenseRange | null {
  if (filters.preset === "custom") {
    if (!filters.from || !filters.to) return null;
    return { from: toLocalDateString(filters.from), to: toLocalDateString(filters.to) };
  }

  const range = resolveDateRangePreset(filters.preset, now);
  return { from: range.from.slice(0, 10), to: range.to.slice(0, 10) };
}
```

- [ ] **Step 5: Etiquetas de UI**

Crea `src/modules/finance/constants.ts`:

```ts
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
```

- [ ] **Step 6: Ejecutar tests y tipos**

Run: `node --test "src/modules/finance/types/expense.test.ts" "src/modules/finance/expense-range.test.ts"`
Expected: PASS, 8/8.

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/modules/finance/types/expense.ts src/modules/finance/types/expense.test.ts src/modules/finance/expense-range.ts src/modules/finance/expense-range.test.ts src/modules/finance/constants.ts
git commit -m "feat(finance): add expense DTOs, category labels and range resolution"
```

---

### Task 6: Repositorios

**Files:**
- Create: `src/server/repositories/expense.repository.ts`
- Create: `src/server/repositories/recurring-expense.repository.ts`

**Interfaces:**
- Consumes: tablas y tipos de Task 1; `db`, `Executor`, `ReadExecutor`.
- Produces (`expenseRepository`): `findById(id, executor?)`, `create(executor, values: ExpenseValues)`, `update(executor, id, values: ExpenseUpdateValues)`, `remove(executor, id)`, `listPaginated(params: ListExpensesParams, executor?) → { data; total; totalCents }`, `insertManyIgnoringConflicts(executor, rows: NewExpense[]) → number`. Produces (`recurringExpenseRepository`): `findById`, `listAll`, `create(executor, values: RecurringExpenseValues)`, `update(executor, id, values: RecurringExpenseUpdateValues)`, `remove`, `lockActive(executor)`, `setGeneratedThrough(executor, id, date)`.

- [ ] **Step 1: Repositorio de egresos**

Crea `src/server/repositories/expense.repository.ts`:

```ts
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import { expenses, type Expense, type ExpenseCategory, type NewExpense } from "@/server/db/schema";

export type ExpenseValues = Pick<
  NewExpense,
  "category" | "description" | "amountCents" | "incurredOn" | "createdBy"
>;

export type ExpenseUpdateValues = Partial<
  Pick<NewExpense, "category" | "description" | "amountCents" | "incurredOn">
>;

export async function findById(id: string, executor: ReadExecutor = db): Promise<Expense | null> {
  const [row] = await executor.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return row ?? null;
}

export async function create(executor: Executor, values: ExpenseValues): Promise<Expense> {
  const [row] = await executor.insert(expenses).values(values).returning();
  return row;
}

export async function update(
  executor: Executor,
  id: string,
  values: ExpenseUpdateValues,
): Promise<Expense | null> {
  const [row] = await executor
    .update(expenses)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(expenses.id, id))
    .returning();

  return row ?? null;
}

export async function remove(executor: Executor, id: string): Promise<void> {
  await executor.delete(expenses).where(eq(expenses.id, id));
}

export type ListExpensesParams = {
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  to: string;
  category?: ExpenseCategory;
  page: number;
  pageSize: number;
};

/**
 * Listado del filtro completo más su total (017 AC6). `totalCents` va como
 * `float8` y no `int`: la suma de muchos egresos puede pasar el rango de 32 bits
 * (mismo hallazgo M1 de la revisión de 016) y `float8` es exacto hasta 2^53.
 */
export async function listPaginated(
  params: ListExpensesParams,
  executor: ReadExecutor = db,
): Promise<{ data: Expense[]; total: number; totalCents: number }> {
  const conditions: SQL[] = [
    gte(expenses.incurredOn, params.from),
    lte(expenses.incurredOn, params.to),
  ];
  if (params.category) conditions.push(eq(expenses.category, params.category));

  const filter = and(...conditions);

  const [totals] = await executor
    .select({
      total: sql<number>`count(*)::int`,
      totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::float8`,
    })
    .from(expenses)
    .where(filter);

  const data = await executor
    .select()
    .from(expenses)
    .where(filter)
    .orderBy(desc(expenses.incurredOn), desc(expenses.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { data, total: totals?.total ?? 0, totalCents: totals?.totalCents ?? 0 };
}

/**
 * Inserta los vencimientos de una plantilla ignorando los que ya existan: el
 * índice único parcial `(recurring_expense_id, incurred_on)` es el candado
 * contra dos ejecuciones concurrentes (017 D6). Devuelve cuántas filas entraron.
 */
export async function insertManyIgnoringConflicts(
  executor: Executor,
  rows: NewExpense[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const inserted = await executor
    .insert(expenses)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: expenses.id });

  return inserted.length;
}
```

- [ ] **Step 2: Repositorio de plantillas**

Crea `src/server/repositories/recurring-expense.repository.ts`:

```ts
import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import type { Executor, ReadExecutor } from "@/server/db/pool";
import {
  recurringExpenses,
  type NewRecurringExpense,
  type RecurringExpense,
} from "@/server/db/schema";

export type RecurringExpenseValues = Pick<
  NewRecurringExpense,
  | "category"
  | "description"
  | "amountCents"
  | "dayOfMonth"
  | "startsOn"
  | "endsOn"
  | "generatedThrough"
  | "createdBy"
>;

export type RecurringExpenseUpdateValues = Partial<
  Pick<
    NewRecurringExpense,
    | "category"
    | "description"
    | "amountCents"
    | "dayOfMonth"
    | "endsOn"
    | "isActive"
    | "generatedThrough"
  >
>;

export async function findById(
  id: string,
  executor: ReadExecutor = db,
): Promise<RecurringExpense | null> {
  const [row] = await executor
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.id, id))
    .limit(1);

  return row ?? null;
}

/** Activas primero, luego por descripción. Son pocas: sin paginación. */
export async function listAll(executor: ReadExecutor = db): Promise<RecurringExpense[]> {
  return executor
    .select()
    .from(recurringExpenses)
    .orderBy(desc(recurringExpenses.isActive), asc(recurringExpenses.description));
}

export async function create(
  executor: Executor,
  values: RecurringExpenseValues,
): Promise<RecurringExpense> {
  const [row] = await executor.insert(recurringExpenses).values(values).returning();
  return row;
}

export async function update(
  executor: Executor,
  id: string,
  values: RecurringExpenseUpdateValues,
): Promise<RecurringExpense | null> {
  const [row] = await executor
    .update(recurringExpenses)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(recurringExpenses.id, id))
    .returning();

  return row ?? null;
}

export async function remove(executor: Executor, id: string): Promise<void> {
  await executor.delete(recurringExpenses).where(eq(recurringExpenses.id, id));
}

/**
 * Bloquea las plantillas activas dentro de la transacción de la generación
 * (017 D6). `SKIP LOCKED`: si otra petición ya las está generando, esta las
 * salta en vez de esperar — esa otra petición materializa sus vencimientos.
 */
export async function lockActive(executor: Executor): Promise<RecurringExpense[]> {
  return executor
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.isActive, true))
    .for("update", { skipLocked: true });
}

export async function setGeneratedThrough(
  executor: Executor,
  id: string,
  generatedThrough: string,
): Promise<void> {
  await executor
    .update(recurringExpenses)
    .set({ generatedThrough, updatedAt: new Date() })
    .where(eq(recurringExpenses.id, id));
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/server/repositories/expense.repository.ts src/server/repositories/recurring-expense.repository.ts
git commit -m "feat(finance): add expense and recurring expense repositories"
```

---

### Task 7: Servicios de servidor

**Files:**
- Create: `src/server/services/recurring-expense.service.ts`
- Create: `src/server/services/expense.service.ts`

**Interfaces:**
- Consumes: repositorios (Task 6); `dueOccurrences`, `lastOccurrenceOnOrBefore`, `minStartsOn`, `toUtcDateString` (Task 3); `CreateExpenseInput`, `UpdateExpenseInput`, `CreateRecurringExpenseInput`, `UpdateRecurringExpenseInput`, `ExpenseCategoryValue` (Task 4, solo tipos); `logAudit`, `diffChanges`; `dbTx`; `NotFoundError`, `BadRequestError`.
- Produces: `ensureRecurringExpenses(today?: string): Promise<number>`, `createRecurringExpense(actor, input, today?)`, `updateRecurringExpense(actor, id, input, today?)`, `deleteRecurringExpense(actor, id)`, `listRecurringExpenses(): Promise<RecurringExpense[]>`; `createExpense(actor, input)`, `updateExpense(actor, id, input)`, `deleteExpense(actor, id)`, `listExpenses(params): Promise<{ data; total; totalCents }>`.

- [ ] **Step 1: Servicio de plantillas y generación**

Crea `src/server/services/recurring-expense.service.ts`:

```ts
import { BadRequestError, NotFoundError } from "@/lib/api-error";
import { diffChanges, logAudit } from "@/lib/audit";
import {
  dueOccurrences,
  lastOccurrenceOnOrBefore,
  minStartsOn,
  toUtcDateString,
} from "@/modules/finance/recurring";
import type {
  CreateRecurringExpenseInput,
  UpdateRecurringExpenseInput,
} from "@/modules/finance/schemas/expense.schema";
import { dbTx } from "@/server/db/pool";
import type { RecurringExpense, User } from "@/server/db/schema";
import * as expenseRepository from "@/server/repositories/expense.repository";
import * as recurringExpenseRepository from "@/server/repositories/recurring-expense.repository";

const ENTITY = "recurring_expense";

function auditableFields(template: RecurringExpense): Record<string, unknown> {
  return {
    category: template.category,
    description: template.description,
    amountCents: template.amountCents,
    dayOfMonth: template.dayOfMonth,
    startsOn: template.startsOn,
    endsOn: template.endsOn,
    isActive: template.isActive,
  };
}

async function requireTemplate(
  tx: Parameters<typeof recurringExpenseRepository.findById>[1],
  id: string,
): Promise<RecurringExpense> {
  const template = await recurringExpenseRepository.findById(id, tx);
  if (!template) throw new NotFoundError("La plantilla no existe.");

  return template;
}

/**
 * Materializa los vencimientos pendientes de las plantillas activas (017 D5).
 * Idempotente y segura en concurrencia: bloquea las plantillas con `FOR UPDATE
 * SKIP LOCKED`, inserta con `ON CONFLICT DO NOTHING` y avanza la marca
 * `generated_through` — por eso un egreso generado que se borra no reaparece
 * (D6). Es una acción del sistema: `actor_id` nulo y sin exigir
 * `finance.manage_expenses`, así que la puede disparar un lector con
 * `finance.read`. Todo lector de egresos debe llamarla antes de leer (D12).
 */
export async function ensureRecurringExpenses(
  today: string = toUtcDateString(new Date()),
): Promise<number> {
  return dbTx.transaction(async (tx) => {
    const templates = await recurringExpenseRepository.lockActive(tx);
    let generated = 0;

    for (const template of templates) {
      const dates = dueOccurrences(template, today);
      if (dates.length === 0) continue;

      const inserted = await expenseRepository.insertManyIgnoringConflicts(
        tx,
        dates.map((incurredOn) => ({
          category: template.category,
          description: template.description,
          amountCents: template.amountCents,
          incurredOn,
          recurringExpenseId: template.id,
          createdBy: null,
        })),
      );

      await recurringExpenseRepository.setGeneratedThrough(tx, template.id, dates[dates.length - 1]);

      await logAudit(tx, {
        actorId: null,
        action: "expense.recurring_generated",
        entityType: ENTITY,
        entityId: template.id,
        metadata: {
          source: "recurring_generation",
          recurringExpenseId: template.id,
          count: inserted,
        },
      });

      generated += inserted;
    }

    return generated;
  });
}

export async function createRecurringExpense(
  actor: User,
  input: CreateRecurringExpenseInput,
  today: string = toUtcDateString(new Date()),
): Promise<RecurringExpense> {
  const earliest = minStartsOn(today);
  if (input.startsOn < earliest) {
    throw new BadRequestError(`La fecha de inicio no puede ser anterior a ${earliest}.`);
  }

  return dbTx.transaction(async (tx) => {
    const template = await recurringExpenseRepository.create(tx, {
      category: input.category,
      description: input.description,
      amountCents: input.amountCents,
      dayOfMonth: input.dayOfMonth,
      startsOn: input.startsOn,
      endsOn: input.endsOn ?? null,
      generatedThrough: null,
      createdBy: actor.id,
    });

    await logAudit(tx, {
      actorId: actor.id,
      action: "recurring_expense.created",
      entityType: ENTITY,
      entityId: template.id,
      changes: { before: null, after: auditableFields(template) },
    });

    return template;
  });
}

export async function updateRecurringExpense(
  actor: User,
  id: string,
  input: UpdateRecurringExpenseInput,
  today: string = toUtcDateString(new Date()),
): Promise<RecurringExpense> {
  return dbTx.transaction(async (tx) => {
    const current = await requireTemplate(tx, id);

    const endsOn = input.endsOn === undefined ? current.endsOn : input.endsOn;
    if (endsOn !== null && endsOn < current.startsOn) {
      throw new BadRequestError("La fecha de fin no puede ser anterior a la de inicio.");
    }

    const dayOfMonth = input.dayOfMonth ?? current.dayOfMonth;

    // Reactivar no genera el período en pausa (017 D7): la marca salta al
    // último vencimiento ≤ hoy.
    let generatedThrough = current.generatedThrough;
    if (input.isActive === true && !current.isActive) {
      const caughtUp = lastOccurrenceOnOrBefore({ dayOfMonth, startsOn: current.startsOn, endsOn }, today);
      if (caughtUp !== null && (generatedThrough === null || caughtUp > generatedThrough)) {
        generatedThrough = caughtUp;
      }
    }

    const updated = await recurringExpenseRepository.update(tx, id, {
      category: input.category ?? current.category,
      description: input.description ?? current.description,
      amountCents: input.amountCents ?? current.amountCents,
      dayOfMonth,
      endsOn,
      isActive: input.isActive ?? current.isActive,
      generatedThrough,
    });

    if (!updated) throw new NotFoundError("La plantilla no existe.");

    const changes = diffChanges(auditableFields(current), auditableFields(updated));
    if (changes) {
      await logAudit(tx, {
        actorId: actor.id,
        action: "recurring_expense.updated",
        entityType: ENTITY,
        entityId: updated.id,
        changes,
      });
    }

    return updated;
  });
}

export async function deleteRecurringExpense(actor: User, id: string): Promise<void> {
  await dbTx.transaction(async (tx) => {
    const template = await requireTemplate(tx, id);

    await recurringExpenseRepository.remove(tx, id);

    await logAudit(tx, {
      actorId: actor.id,
      action: "recurring_expense.deleted",
      entityType: ENTITY,
      entityId: template.id,
      changes: { before: auditableFields(template), after: null },
      severity: "warning",
    });
  });
}

/** Genera antes de leer (017 D12): el listado muestra el próximo vencimiento ya al día. */
export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  await ensureRecurringExpenses();
  return recurringExpenseRepository.listAll();
}
```

- [ ] **Step 2: Servicio de egresos**

Crea `src/server/services/expense.service.ts`:

```ts
import { NotFoundError } from "@/lib/api-error";
import { diffChanges, logAudit } from "@/lib/audit";
import type {
  CreateExpenseInput,
  ExpenseCategoryValue,
  UpdateExpenseInput,
} from "@/modules/finance/schemas/expense.schema";
import { dbTx } from "@/server/db/pool";
import type { Expense, ExpenseCategory, User } from "@/server/db/schema";
import * as expenseRepository from "@/server/repositories/expense.repository";
import { ensureRecurringExpenses } from "@/server/services/recurring-expense.service";

const ENTITY = "expense";

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * La lista de categorías del schema Zod (cliente) y la del enum de Postgres
 * (servidor) están duplicadas a propósito. Esta constante falla en compilación
 * si divergen: sin ella, agregar una a un lado solo se notaría en producción.
 */
const categoriesInSync: Equals<ExpenseCategory, ExpenseCategoryValue> = true;
void categoriesInSync;

function auditableFields(expense: Expense): Record<string, unknown> {
  return {
    category: expense.category,
    description: expense.description,
    amountCents: expense.amountCents,
    incurredOn: expense.incurredOn,
    recurringExpenseId: expense.recurringExpenseId,
  };
}

export async function createExpense(actor: User, input: CreateExpenseInput): Promise<Expense> {
  return dbTx.transaction(async (tx) => {
    const expense = await expenseRepository.create(tx, {
      category: input.category,
      description: input.description,
      amountCents: input.amountCents,
      incurredOn: input.incurredOn,
      createdBy: actor.id,
    });

    await logAudit(tx, {
      actorId: actor.id,
      action: "expense.created",
      entityType: ENTITY,
      entityId: expense.id,
      changes: { before: null, after: auditableFields(expense) },
    });

    return expense;
  });
}

export async function updateExpense(
  actor: User,
  id: string,
  input: UpdateExpenseInput,
): Promise<Expense> {
  return dbTx.transaction(async (tx) => {
    const current = await expenseRepository.findById(id, tx);
    if (!current) throw new NotFoundError("El egreso no existe.");

    const updated = await expenseRepository.update(tx, id, input);
    if (!updated) throw new NotFoundError("El egreso no existe.");

    const changes = diffChanges(auditableFields(current), auditableFields(updated));
    if (changes) {
      await logAudit(tx, {
        actorId: actor.id,
        action: "expense.updated",
        entityType: ENTITY,
        entityId: updated.id,
        changes,
      });
    }

    return updated;
  });
}

/** Borrado físico (017 D3): la foto completa queda en `audit_logs.changes.before`. */
export async function deleteExpense(actor: User, id: string): Promise<void> {
  await dbTx.transaction(async (tx) => {
    const expense = await expenseRepository.findById(id, tx);
    if (!expense) throw new NotFoundError("El egreso no existe.");

    await expenseRepository.remove(tx, id);

    await logAudit(tx, {
      actorId: actor.id,
      action: "expense.deleted",
      entityType: ENTITY,
      entityId: expense.id,
      changes: { before: auditableFields(expense), after: null },
      severity: "warning",
    });
  });
}

/** Genera los vencimientos pendientes antes de leer (017 D5/D12). */
export async function listExpenses(
  params: expenseRepository.ListExpensesParams,
): Promise<{ data: Expense[]; total: number; totalCents: number }> {
  await ensureRecurringExpenses();
  return expenseRepository.listPaginated(params);
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores. Si `requireTemplate` no tipa su parámetro `tx`, tipa `tx` con `import type { ReadExecutor } from "@/server/db/pool"` (es un `ReadExecutor`, que incluye la transacción).

- [ ] **Step 4: Commit**

```bash
git add src/server/services/recurring-expense.service.ts src/server/services/expense.service.ts
git commit -m "feat(finance): add expense services with audit and idempotent recurring generation"
```

---

### Task 8: Route handlers

**Files:**
- Create: `src/app/api/admin/finance/expenses/route.ts`
- Create: `src/app/api/admin/finance/expenses/[id]/route.ts`
- Create: `src/app/api/admin/finance/recurring-expenses/route.ts`
- Create: `src/app/api/admin/finance/recurring-expenses/[id]/route.ts`

**Interfaces:**
- Consumes: servicios (Task 7); schemas (Task 4); `toExpenseDto`, `toRecurringExpenseDto`, `ExpenseDto`, `ExpenseListResponse`, `RecurringExpenseDto` (Task 5); `toUtcDateString` (Task 3); `requirePermission`, `PERMISSIONS.FINANCE_READ`, `PERMISSIONS.FINANCE_MANAGE_EXPENSES`; `toErrorResponse`.
- Produces: los 8 endpoints de la tabla de API del spec.

- [ ] **Step 1: Listado y alta de egresos**

Crea `src/app/api/admin/finance/expenses/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { createExpenseSchema, expensesQuerySchema } from "@/modules/finance/schemas/expense.schema";
import {
  toExpenseDto,
  type ExpenseDto,
  type ExpenseListResponse,
} from "@/modules/finance/types/expense";
import { createExpense, listExpenses } from "@/server/services/expense.service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const query = expensesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total, totalCents } = await listExpenses(query);

    return NextResponse.json<ExpenseListResponse>({
      data: data.map(toExpenseDto),
      meta: { page: query.page, pageSize: query.pageSize, total },
      totalCents,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    const input = createExpenseSchema.parse(await request.json());
    const expense = await createExpense(actor, input);

    return NextResponse.json<ExpenseDto>(toExpenseDto(expense), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: Edición y borrado de un egreso**

Crea `src/app/api/admin/finance/expenses/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { updateExpenseSchema } from "@/modules/finance/schemas/expense.schema";
import { toExpenseDto, type ExpenseDto } from "@/modules/finance/types/expense";
import { deleteExpense, updateExpense } from "@/server/services/expense.service";

type Context = { params: Promise<{ id: string }> };

async function resolveId(context: Context): Promise<string> {
  const { id } = await context.params;
  return z.uuid().parse(id);
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    const id = await resolveId(context);
    const input = updateExpenseSchema.parse(await request.json());

    return NextResponse.json<ExpenseDto>(toExpenseDto(await updateExpense(actor, id, input)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    await deleteExpense(actor, await resolveId(context));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: Listado y alta de plantillas**

Crea `src/app/api/admin/finance/recurring-expenses/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { toUtcDateString } from "@/modules/finance/recurring";
import { createRecurringExpenseSchema } from "@/modules/finance/schemas/expense.schema";
import {
  toRecurringExpenseDto,
  type RecurringExpenseDto,
} from "@/modules/finance/types/expense";
import {
  createRecurringExpense,
  listRecurringExpenses,
} from "@/server/services/recurring-expense.service";

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const today = toUtcDateString(new Date());
    const rows = await listRecurringExpenses();

    return NextResponse.json<{ data: RecurringExpenseDto[] }>({
      data: rows.map((row) => toRecurringExpenseDto(row, today)),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    const input = createRecurringExpenseSchema.parse(await request.json());
    const template = await createRecurringExpense(actor, input);

    return NextResponse.json<RecurringExpenseDto>(
      toRecurringExpenseDto(template, toUtcDateString(new Date())),
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 4: Edición y borrado de una plantilla**

Crea `src/app/api/admin/finance/recurring-expenses/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { toUtcDateString } from "@/modules/finance/recurring";
import { updateRecurringExpenseSchema } from "@/modules/finance/schemas/expense.schema";
import {
  toRecurringExpenseDto,
  type RecurringExpenseDto,
} from "@/modules/finance/types/expense";
import {
  deleteRecurringExpense,
  updateRecurringExpense,
} from "@/server/services/recurring-expense.service";

type Context = { params: Promise<{ id: string }> };

async function resolveId(context: Context): Promise<string> {
  const { id } = await context.params;
  return z.uuid().parse(id);
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    const id = await resolveId(context);
    const input = updateRecurringExpenseSchema.parse(await request.json());
    const template = await updateRecurringExpense(actor, id, input);

    return NextResponse.json<RecurringExpenseDto>(
      toRecurringExpenseDto(template, toUtcDateString(new Date())),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_EXPENSES);

    await deleteRecurringExpense(actor, await resolveId(context));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/admin/finance/expenses/" "src/app/api/admin/finance/recurring-expenses/"
git commit -m "feat(finance): add expense and recurring expense route handlers"
```

---

### Task 9: Servicios cliente y hooks

**Files:**
- Create: `src/modules/finance/services/expense.service.ts`
- Create: `src/modules/finance/hooks/use-expenses.ts`

**Interfaces:**
- Consumes: `api` (`@/lib/axios`); tipos de Tasks 4 y 5; `resolveExpenseRange` (Task 5); `expenseFiltersSchema`, `ExpenseFilters`, `ExpensesQuery`, `ExpenseCategoryValue` (Task 4); `RevenueFilterPreset` (`revenue.schema`).
- Produces (servicio): `fetchExpenses(query)`, `createExpense(input)`, `updateExpense(id, input)`, `deleteExpense(id)`, `fetchRecurringExpenses()`, `createRecurringExpense(input)`, `updateRecurringExpense(id, input)`, `deleteRecurringExpense(id)`. Produces (hooks): `expenseKeys`, `EXPENSES_PAGE_SIZE`, `useExpenseFilters()` → `{ filters, query, setPreset, setCustomRange, setCategory, setPage }`, `useExpenses(query)`, `useRecurringExpenses()`, `useCreateExpense()`, `useUpdateExpense()`, `useDeleteExpense()`, `useCreateRecurringExpense()`, `useUpdateRecurringExpense()`, `useDeleteRecurringExpense()`.

- [ ] **Step 1: Servicio axios**

Crea `src/modules/finance/services/expense.service.ts`:

```ts
import { api } from "@/lib/axios";
import type {
  CreateExpenseInput,
  CreateRecurringExpenseInput,
  ExpensesQuery,
  UpdateExpenseInput,
  UpdateRecurringExpenseInput,
} from "@/modules/finance/schemas/expense.schema";
import type {
  ExpenseDto,
  ExpenseListResponse,
  RecurringExpenseDto,
} from "@/modules/finance/types/expense";

export async function fetchExpenses(query: ExpensesQuery): Promise<ExpenseListResponse> {
  const { data } = await api.get<ExpenseListResponse>("/admin/finance/expenses", { params: query });
  return data;
}

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseDto> {
  const { data } = await api.post<ExpenseDto>("/admin/finance/expenses", input);
  return data;
}

export async function updateExpense(id: string, input: UpdateExpenseInput): Promise<ExpenseDto> {
  const { data } = await api.patch<ExpenseDto>(`/admin/finance/expenses/${id}`, input);
  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/admin/finance/expenses/${id}`);
}

export async function fetchRecurringExpenses(): Promise<RecurringExpenseDto[]> {
  const { data } = await api.get<{ data: RecurringExpenseDto[] }>("/admin/finance/recurring-expenses");
  return data.data;
}

export async function createRecurringExpense(
  input: CreateRecurringExpenseInput,
): Promise<RecurringExpenseDto> {
  const { data } = await api.post<RecurringExpenseDto>("/admin/finance/recurring-expenses", input);
  return data;
}

export async function updateRecurringExpense(
  id: string,
  input: UpdateRecurringExpenseInput,
): Promise<RecurringExpenseDto> {
  const { data } = await api.patch<RecurringExpenseDto>(
    `/admin/finance/recurring-expenses/${id}`,
    input,
  );
  return data;
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  await api.delete(`/admin/finance/recurring-expenses/${id}`);
}
```

- [ ] **Step 2: Hooks**

Crea `src/modules/finance/hooks/use-expenses.ts`:

```ts
"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { resolveExpenseRange } from "@/modules/finance/expense-range";
import type { RevenueFilterPreset } from "@/modules/finance/schemas/revenue.schema";
import {
  expenseFiltersSchema,
  type CreateExpenseInput,
  type CreateRecurringExpenseInput,
  type ExpenseCategoryValue,
  type ExpenseFilters,
  type ExpensesQuery,
  type UpdateExpenseInput,
  type UpdateRecurringExpenseInput,
} from "@/modules/finance/schemas/expense.schema";
import {
  createExpense,
  createRecurringExpense,
  deleteExpense,
  deleteRecurringExpense,
  fetchExpenses,
  fetchRecurringExpenses,
  updateExpense,
  updateRecurringExpense,
} from "@/modules/finance/services/expense.service";

export const EXPENSES_PAGE_SIZE = 20;

export const expenseKeys = {
  all: ["finance", "expenses"] as const,
  list: (query: ExpensesQuery) => [...expenseKeys.all, "list", query] as const,
  recurring: () => [...expenseKeys.all, "recurring"] as const,
};

const DEFAULT_FILTERS: ExpenseFilters = { preset: "this_month", page: 1 };

/** Única traducción entre la URL y `expenseFiltersSchema`, mismo patrón que `useRevenueFilters`. */
export function useExpenseFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<ExpenseFilters>(() => {
    const parsed = expenseFiltersSchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_FILTERS;
  }, [searchParams]);

  const query = useMemo<ExpensesQuery | null>(() => {
    const range = resolveExpenseRange(filters);
    if (!range) return null;

    return { ...range, category: filters.category, page: filters.page, pageSize: EXPENSES_PAGE_SIZE };
  }, [filters]);

  const push = useCallback(
    (next: ExpenseFilters) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") continue;
        if (key === "page" && value === 1) continue;
        params.set(key, String(value));
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const setPreset = useCallback(
    (preset: RevenueFilterPreset) =>
      push(
        preset === "custom"
          ? { ...filters, preset, page: 1 }
          : { preset, category: filters.category, page: 1 },
      ),
    [filters, push],
  );

  const setCustomRange = useCallback(
    (range: { from?: string; to?: string }) =>
      push({ category: filters.category, preset: "custom", ...range, page: 1 }),
    [filters.category, push],
  );

  const setCategory = useCallback(
    (category: ExpenseCategoryValue | undefined) => push({ ...filters, category, page: 1 }),
    [filters, push],
  );

  const setPage = useCallback((page: number) => push({ ...filters, page }), [filters, push]);

  return { filters, query, setPreset, setCustomRange, setCategory, setPage };
}

export function useExpenses(query: ExpensesQuery | null) {
  return useQuery({
    queryKey: query ? expenseKeys.list(query) : expenseKeys.all,
    queryFn: () => {
      if (!query) throw new Error("No hay rango seleccionado.");
      return fetchExpenses(query);
    },
    enabled: query !== null,
    placeholderData: keepPreviousData,
  });
}

export function useRecurringExpenses() {
  return useQuery({ queryKey: expenseKeys.recurring(), queryFn: fetchRecurringExpenses });
}

/**
 * Cualquier mutación invalida las dos vistas: crear una plantilla hace que la
 * siguiente lectura genere egresos, y borrar un egreso puede cambiar el
 * próximo vencimiento que muestra la otra pestaña.
 */
function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expenseKeys.all });
}

export function useCreateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => createExpense(input),
    onSuccess: invalidate,
  });
}

export function useUpdateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExpenseInput }) => updateExpense(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({ mutationFn: (id: string) => deleteExpense(id), onSuccess: invalidate });
}

export function useCreateRecurringExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (input: CreateRecurringExpenseInput) => createRecurringExpense(input),
    onSuccess: invalidate,
  });
}

export function useUpdateRecurringExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRecurringExpenseInput }) =>
      updateRecurringExpense(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRecurringExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: (id: string) => deleteRecurringExpense(id),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/finance/services/expense.service.ts src/modules/finance/hooks/use-expenses.ts
git commit -m "feat(finance): add expense axios service and TanStack Query hooks"
```

---

### Task 10: UI — diálogos

**Files:**
- Create: `src/modules/finance/components/confirm-delete-dialog.tsx`
- Create: `src/modules/finance/components/expense-form-dialog.tsx`
- Create: `src/modules/finance/components/recurring-form-dialog.tsx`

**Interfaces:**
- Consumes: hooks y schemas de Tasks 4 y 9; `EXPENSE_CATEGORY_LABEL`, `formatDateOnly` (Task 5); `toLocalDateString` (Task 5); `dueOccurrences`, `toUtcDateString` (Task 3); DTOs (Task 5).
- Produces: `ConfirmDeleteDialog` (`{ open; onOpenChange; title; description; isPending; errorMessage; onConfirm }`), `ExpenseFormDialog` (`{ open; onOpenChange; expense: ExpenseDto | null }`, `null` = alta), `RecurringFormDialog` (`{ open; onOpenChange; template: RecurringExpenseDto | null }`).

- [ ] **Step 1: Diálogo de confirmación de borrado (genérico)**

Crea `src/modules/finance/components/confirm-delete-dialog.tsx`:

```tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  isPending: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  isPending,
  errorMessage,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage ? (
          <p role="alert" className="text-destructive text-sm">
            {errorMessage}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
          >
            {isPending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Diálogo de alta/edición de egreso**

Crea `src/modules/finance/components/expense-form-dialog.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORY_LABEL } from "@/modules/finance/constants";
import { toLocalDateString } from "@/modules/finance/expense-range";
import { useCreateExpense, useUpdateExpense } from "@/modules/finance/hooks/use-expenses";
import {
  EXPENSE_CATEGORY_VALUES,
  expenseFormSchema,
  toCreateExpenseInput,
  type ExpenseCategoryValue,
  type ExpenseFormValues,
} from "@/modules/finance/schemas/expense.schema";
import type { ExpenseDto } from "@/modules/finance/types/expense";

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = alta. */
  expense: ExpenseDto | null;
};

function initialValues(expense: ExpenseDto | null): ExpenseFormValues {
  if (!expense) {
    return {
      category: "other",
      description: "",
      amount: "",
      incurredOn: toLocalDateString(new Date().toISOString()),
    };
  }

  return {
    category: expense.category,
    description: expense.description,
    amount: (expense.amountCents / 100).toFixed(2),
    incurredOn: expense.incurredOn,
  };
}

export function ExpenseFormDialog({ open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const createMutation = useCreateExpense();
  const updateMutation = useUpdateExpense();
  const mutation = expense ? updateMutation : createMutation;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initialValues(null),
  });

  const { control, formState, handleSubmit, register, reset } = form;
  const resetCreate = createMutation.reset;
  const resetUpdate = updateMutation.reset;

  useEffect(() => {
    if (!open) return;

    resetCreate();
    resetUpdate();
    reset(initialValues(expense));
  }, [open, expense, reset, resetCreate, resetUpdate]);

  function onSubmit(values: ExpenseFormValues) {
    const input = toCreateExpenseInput(values);
    const onSuccess = () => {
      toast.success(expense ? "Egreso actualizado." : "Egreso registrado.");
      onOpenChange(false);
    };

    if (expense) updateMutation.mutate({ id: expense.id, input }, { onSuccess });
    else createMutation.mutate(input, { onSuccess });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Editar egreso" : "Nuevo egreso"}</DialogTitle>
          <DialogDescription>
            Gastos operativos del negocio. La compra de mercadería no se registra aquí: su costo ya
            está en el costo por producto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="expense-category">Categoría</FieldLabel>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="expense-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORY_VALUES.map((category: ExpenseCategoryValue) => (
                      <SelectItem key={category} value={category}>
                        {EXPENSE_CATEGORY_LABEL[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[formState.errors.category]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="expense-description">Descripción</FieldLabel>
            <Input id="expense-description" placeholder="Alquiler de marzo" {...register("description")} />
            <FieldError errors={[formState.errors.description]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="expense-amount">Monto</FieldLabel>
              <Input id="expense-amount" inputMode="decimal" placeholder="0.00" {...register("amount")} />
              <FieldError errors={[formState.errors.amount]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="expense-date">Fecha</FieldLabel>
              <Input id="expense-date" type="date" {...register("incurredOn")} />
              <FieldError errors={[formState.errors.incurredOn]} />
            </Field>
          </div>

          {mutation.error ? (
            <p role="alert" className="text-destructive text-sm">
              {mutation.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Diálogo de alta/edición de plantilla**

Crea `src/modules/finance/components/recurring-form-dialog.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORY_LABEL } from "@/modules/finance/constants";
import { toLocalDateString } from "@/modules/finance/expense-range";
import {
  useCreateRecurringExpense,
  useUpdateRecurringExpense,
} from "@/modules/finance/hooks/use-expenses";
import { dueOccurrences, toUtcDateString } from "@/modules/finance/recurring";
import {
  EXPENSE_CATEGORY_VALUES,
  recurringFormSchema,
  toCreateRecurringInput,
  toUpdateRecurringInput,
  type ExpenseCategoryValue,
  type RecurringFormValues,
} from "@/modules/finance/schemas/expense.schema";
import type { RecurringExpenseDto } from "@/modules/finance/types/expense";

type RecurringFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = alta. */
  template: RecurringExpenseDto | null;
};

function initialValues(template: RecurringExpenseDto | null): RecurringFormValues {
  if (!template) {
    return {
      category: "other",
      description: "",
      amount: "",
      dayOfMonth: "1",
      startsOn: toLocalDateString(new Date().toISOString()),
      endsOn: "",
      isActive: true,
    };
  }

  return {
    category: template.category,
    description: template.description,
    amount: (template.amountCents / 100).toFixed(2),
    dayOfMonth: String(template.dayOfMonth),
    startsOn: template.startsOn,
    endsOn: template.endsOn ?? "",
    isActive: template.isActive,
  };
}

/** Cuántos egresos de meses pasados generará el alta (017 D8): el aviso del formulario. */
function pastOccurrencesCount(values: Partial<RecurringFormValues>): number {
  const dayOfMonth = Number.parseInt(values.dayOfMonth ?? "", 10);
  if (!values.startsOn || !/^\d{4}-\d{2}-\d{2}$/.test(values.startsOn)) return 0;
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return 0;

  return dueOccurrences(
    {
      dayOfMonth,
      startsOn: values.startsOn,
      endsOn: values.endsOn ? values.endsOn : null,
      generatedThrough: null,
    },
    toUtcDateString(new Date()),
  ).length;
}

export function RecurringFormDialog({ open, onOpenChange, template }: RecurringFormDialogProps) {
  const createMutation = useCreateRecurringExpense();
  const updateMutation = useUpdateRecurringExpense();
  const mutation = template ? updateMutation : createMutation;

  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: initialValues(null),
  });

  const { control, formState, handleSubmit, register, reset } = form;
  const resetCreate = createMutation.reset;
  const resetUpdate = updateMutation.reset;

  useEffect(() => {
    if (!open) return;

    resetCreate();
    resetUpdate();
    reset(initialValues(template));
  }, [open, template, reset, resetCreate, resetUpdate]);

  const watched = useWatch({ control });
  const backfill = template ? 0 : pastOccurrencesCount(watched);

  function onSubmit(values: RecurringFormValues) {
    const onSuccess = () => {
      toast.success(template ? "Plantilla actualizada." : "Plantilla creada.");
      onOpenChange(false);
    };

    if (template) {
      updateMutation.mutate({ id: template.id, input: toUpdateRecurringInput(values) }, { onSuccess });
    } else {
      createMutation.mutate(toCreateRecurringInput(values), { onSuccess });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar plantilla" : "Nueva plantilla recurrente"}</DialogTitle>
          <DialogDescription>
            Genera un egreso cada mes de forma automática. Editarla solo afecta los próximos
            vencimientos; lo ya generado no cambia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="recurring-category">Categoría</FieldLabel>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="recurring-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORY_VALUES.map((category: ExpenseCategoryValue) => (
                      <SelectItem key={category} value={category}>
                        {EXPENSE_CATEGORY_LABEL[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[formState.errors.category]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="recurring-description">Descripción</FieldLabel>
            <Input id="recurring-description" placeholder="Alquiler del local" {...register("description")} />
            <FieldError errors={[formState.errors.description]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="recurring-amount">Monto mensual</FieldLabel>
              <Input id="recurring-amount" inputMode="decimal" placeholder="0.00" {...register("amount")} />
              <FieldError errors={[formState.errors.amount]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-day">Día del mes</FieldLabel>
              <Input id="recurring-day" inputMode="numeric" placeholder="1" {...register("dayOfMonth")} />
              <FieldDescription>Del 29 al 31, en meses cortos cae el último día.</FieldDescription>
              <FieldError errors={[formState.errors.dayOfMonth]} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="recurring-starts">Empieza el</FieldLabel>
              <Input id="recurring-starts" type="date" disabled={template !== null} {...register("startsOn")} />
              {template ? (
                <FieldDescription>No se edita: crea otra plantilla para otra fecha.</FieldDescription>
              ) : null}
              <FieldError errors={[formState.errors.startsOn]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="recurring-ends">Termina el (opcional)</FieldLabel>
              <Input id="recurring-ends" type="date" {...register("endsOn")} />
              <FieldError errors={[formState.errors.endsOn]} />
            </Field>
          </div>

          {template ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("isActive")} />
              Activa (desmárcala para pausarla; al reactivarla no se generan los meses en pausa)
            </label>
          ) : null}

          {backfill > 0 ? (
            <p className="text-muted-foreground text-sm">
              Se generarán {backfill} egreso(s) de meses pasados al guardar.
            </p>
          ) : null}

          {mutation.error ? (
            <p role="alert" className="text-destructive text-sm">
              {mutation.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Verificar tipos y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores. (Si el `Select` de base-ui tipa `onValueChange` con `string | null`, adapta con `(value) => value && field.onChange(value)`; registra el ajuste como ruling.)

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/components/confirm-delete-dialog.tsx src/modules/finance/components/expense-form-dialog.tsx src/modules/finance/components/recurring-form-dialog.tsx
git commit -m "feat(finance): add expense, recurring and delete dialogs"
```

---

### Task 11: UI — tablas, filtros, manager, página y navegación

**Files:**
- Create: `src/modules/finance/components/expense-filters.tsx`
- Create: `src/modules/finance/components/expenses-table.tsx`
- Create: `src/modules/finance/components/recurring-expenses-table.tsx`
- Create: `src/modules/finance/components/expenses-manager.tsx`
- Create: `src/app/(admin)/admin/finance/expenses/page.tsx`
- Modify: `src/components/shared/admin-shell.tsx`

**Interfaces:**
- Consumes: todo lo anterior; `RevenueRangePicker` (fase 2); `DataTable`, `createDataTableColumnHelper`; `Tabs`; `formatPriceFromCents`; `can`, `PERMISSIONS`.
- Produces: `ExpensesManager` (`{ canManage: boolean }`), página `/admin/finance/expenses`, entrada de nav "Egresos".

- [ ] **Step 1: Filtros**

Crea `src/modules/finance/components/expense-filters.tsx`:

```tsx
"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RevenueRangePicker } from "@/modules/finance/components/revenue-range-picker";
import { EXPENSE_CATEGORY_LABEL } from "@/modules/finance/constants";
import {
  EXPENSE_CATEGORY_VALUES,
  type ExpenseCategoryValue,
  type ExpenseFilters,
} from "@/modules/finance/schemas/expense.schema";
import type { RevenueFilterPreset } from "@/modules/finance/schemas/revenue.schema";

type ExpenseFiltersProps = {
  filters: ExpenseFilters;
  onPresetChange: (preset: RevenueFilterPreset) => void;
  onCustomRangeChange: (range: { from?: string; to?: string }) => void;
  onCategoryChange: (category: ExpenseCategoryValue | undefined) => void;
};

const ALL = "all";

export function ExpenseFiltersBar({
  filters,
  onPresetChange,
  onCustomRangeChange,
  onCategoryChange,
}: ExpenseFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <RevenueRangePicker
        filters={filters}
        onPresetChange={onPresetChange}
        onCustomRangeChange={onCustomRangeChange}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-category-filter">Categoría</Label>
        <Select
          value={filters.category ?? ALL}
          onValueChange={(value) =>
            onCategoryChange(value === ALL ? undefined : (value as ExpenseCategoryValue))
          }
        >
          <SelectTrigger id="expense-category-filter" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {EXPENSE_CATEGORY_VALUES.map((category) => (
              <SelectItem key={category} value={category}>
                {EXPENSE_CATEGORY_LABEL[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tabla de egresos**

Crea `src/modules/finance/components/expenses-table.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPriceFromCents } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABEL, formatDateOnly } from "@/modules/finance/constants";
import type { ExpenseDto } from "@/modules/finance/types/expense";

type ExpensesTableProps = {
  rows: ExpenseDto[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onEdit: (row: ExpenseDto) => void;
  onDelete: (row: ExpenseDto) => void;
  /** Sin `finance.manage_expenses` la tabla se ve completa, sin acciones (017 AC4). */
  canManage: boolean;
};

const helper = createDataTableColumnHelper<ExpenseDto>();

export function ExpensesTable({
  rows,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
  canManage,
}: ExpensesTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("incurredOn", {
          header: "Fecha",
          cell: (context) => (
            <span className="whitespace-nowrap">{formatDateOnly(context.getValue())}</span>
          ),
        }),
        helper.accessor("category", {
          header: "Categoría",
          cell: (context) => <Badge variant="outline">{EXPENSE_CATEGORY_LABEL[context.getValue()]}</Badge>,
        }),
        helper.accessor("description", {
          header: "Descripción",
          cell: (context) => {
            const row = context.row.original;

            return (
              <div className="flex items-center gap-2">
                <span className="text-sm">{row.description}</span>
                {row.recurringExpenseId ? <Badge variant="secondary">Recurrente</Badge> : null}
              </div>
            );
          },
        }),
        helper.accessor("amountCents", {
          header: "Monto",
          cell: (context) => (
            <span className="tabular-nums">{formatPriceFromCents(context.getValue())}</span>
          ),
        }),
        helper.display({
          id: "actions",
          header: "Acciones",
          cell: (context) => {
            if (!canManage) return null;
            const row = context.row.original;

            return (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(row)}
                  aria-label={`Editar ${row.description}`}
                >
                  <PencilIcon className="size-4" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(row)}
                  aria-label={`Eliminar ${row.description}`}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [canManage, onDelete, onEdit],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay egresos en el rango elegido."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
```

- [ ] **Step 3: Tabla de plantillas**

Crea `src/modules/finance/components/recurring-expenses-table.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPriceFromCents } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABEL, formatDateOnly } from "@/modules/finance/constants";
import type { RecurringExpenseDto } from "@/modules/finance/types/expense";

type RecurringExpensesTableProps = {
  rows: RecurringExpenseDto[];
  isLoading: boolean;
  errorMessage: string | null;
  onEdit: (row: RecurringExpenseDto) => void;
  onDelete: (row: RecurringExpenseDto) => void;
  canManage: boolean;
};

const helper = createDataTableColumnHelper<RecurringExpenseDto>();

export function RecurringExpensesTable({
  rows,
  isLoading,
  errorMessage,
  onEdit,
  onDelete,
  canManage,
}: RecurringExpensesTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("description", {
          header: "Plantilla",
          cell: (context) => {
            const row = context.row.original;

            return (
              <div className="flex flex-col">
                <span className="text-sm font-medium">{row.description}</span>
                <span className="text-muted-foreground text-xs">
                  {EXPENSE_CATEGORY_LABEL[row.category]}
                </span>
              </div>
            );
          },
        }),
        helper.accessor("amountCents", {
          header: "Monto mensual",
          cell: (context) => (
            <span className="tabular-nums">{formatPriceFromCents(context.getValue())}</span>
          ),
        }),
        helper.accessor("dayOfMonth", {
          header: "Día",
          cell: (context) => <span className="tabular-nums">{context.getValue()}</span>,
        }),
        helper.accessor("nextDueOn", {
          header: "Próximo vencimiento",
          cell: (context) => {
            const value = context.getValue();

            return (
              <span className="text-muted-foreground whitespace-nowrap">
                {value ? formatDateOnly(value) : "—"}
              </span>
            );
          },
        }),
        helper.accessor("isActive", {
          header: "Estado",
          cell: (context) => (
            <Badge variant={context.getValue() ? "default" : "outline"}>
              {context.getValue() ? "Activa" : "Pausada"}
            </Badge>
          ),
        }),
        helper.display({
          id: "actions",
          header: "Acciones",
          cell: (context) => {
            if (!canManage) return null;
            const row = context.row.original;

            return (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(row)}
                  aria-label={`Editar ${row.description}`}
                >
                  <PencilIcon className="size-4" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(row)}
                  aria-label={`Eliminar ${row.description}`}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [canManage, onDelete, onEdit],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="Todavía no hay plantillas recurrentes."
    />
  );
}
```

- [ ] **Step 4: Manager con pestañas**

Crea `src/modules/finance/components/expenses-manager.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPriceFromCents } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/modules/finance/components/confirm-delete-dialog";
import { ExpenseFiltersBar } from "@/modules/finance/components/expense-filters";
import { ExpenseFormDialog } from "@/modules/finance/components/expense-form-dialog";
import { ExpensesTable } from "@/modules/finance/components/expenses-table";
import { RecurringExpensesTable } from "@/modules/finance/components/recurring-expenses-table";
import { RecurringFormDialog } from "@/modules/finance/components/recurring-form-dialog";
import {
  EXPENSES_PAGE_SIZE,
  useDeleteExpense,
  useDeleteRecurringExpense,
  useExpenseFilters,
  useExpenses,
  useRecurringExpenses,
} from "@/modules/finance/hooks/use-expenses";
import type { ExpenseDto, RecurringExpenseDto } from "@/modules/finance/types/expense";

type ExpensesManagerProps = {
  /** Lo resuelve la página en servidor con `can('finance.manage_expenses')`. */
  canManage: boolean;
};

export function ExpensesManager({ canManage }: ExpensesManagerProps) {
  const { filters, query, setPreset, setCustomRange, setCategory, setPage } = useExpenseFilters();
  const expenses = useExpenses(query);
  const recurring = useRecurringExpenses();

  const deleteExpense = useDeleteExpense();
  const deleteRecurring = useDeleteRecurringExpense();

  const [expenseForm, setExpenseForm] = useState<ExpenseDto | "new" | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseDto | null>(null);
  const [recurringForm, setRecurringForm] = useState<RecurringExpenseDto | "new" | null>(null);
  const [recurringToDelete, setRecurringToDelete] = useState<RecurringExpenseDto | null>(null);

  const { reset: resetDeleteExpense } = deleteExpense;
  const { reset: resetDeleteRecurring } = deleteRecurring;

  const askDeleteExpense = useCallback(
    (row: ExpenseDto) => {
      resetDeleteExpense();
      setExpenseToDelete(row);
    },
    [resetDeleteExpense],
  );

  const askDeleteRecurring = useCallback(
    (row: RecurringExpenseDto) => {
      resetDeleteRecurring();
      setRecurringToDelete(row);
    },
    [resetDeleteRecurring],
  );

  const editExpense = useCallback((row: ExpenseDto) => setExpenseForm(row), []);
  const editRecurring = useCallback((row: RecurringExpenseDto) => setRecurringForm(row), []);

  function confirmDeleteExpense() {
    const target = expenseToDelete;
    if (!target) return;

    deleteExpense.mutate(target.id, {
      onSuccess: () => {
        toast.success("Egreso eliminado.");
        setExpenseToDelete(null);
      },
    });
  }

  function confirmDeleteRecurring() {
    const target = recurringToDelete;
    if (!target) return;

    deleteRecurring.mutate(target.id, {
      onSuccess: () => {
        toast.success("Plantilla eliminada. Los egresos ya generados se conservan.");
        setRecurringToDelete(null);
      },
    });
  }

  return (
    <>
      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Egresos</TabsTrigger>
          <TabsTrigger value="recurring">Recurrentes</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="flex flex-col gap-5 pt-3">
          <ExpenseFiltersBar
            filters={filters}
            onPresetChange={setPreset}
            onCustomRangeChange={setCustomRange}
            onCategoryChange={setCategory}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Total del filtro:{" "}
              <strong className="tabular-nums">
                {formatPriceFromCents(expenses.data?.totalCents ?? 0)}
              </strong>{" "}
              <span className="text-muted-foreground">
                · {expenses.data?.meta.total ?? 0} egreso(s)
              </span>
            </p>

            {canManage ? (
              <Button size="sm" onClick={() => setExpenseForm("new")}>
                <PlusIcon className="size-4" />
                Nuevo egreso
              </Button>
            ) : null}
          </div>

          {query === null ? (
            <p className="text-muted-foreground text-sm">Elige un rango de fechas para ver los egresos.</p>
          ) : null}

          <ExpensesTable
            rows={expenses.data?.data ?? []}
            isLoading={expenses.isLoading}
            errorMessage={expenses.error?.message ?? null}
            page={filters.page}
            pageSize={EXPENSES_PAGE_SIZE}
            total={expenses.data?.meta.total ?? 0}
            onPageChange={setPage}
            onEdit={editExpense}
            onDelete={askDeleteExpense}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="recurring" className="flex flex-col gap-5 pt-3">
          {canManage ? (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setRecurringForm("new")}>
                <PlusIcon className="size-4" />
                Nueva plantilla
              </Button>
            </div>
          ) : null}

          <RecurringExpensesTable
            rows={recurring.data ?? []}
            isLoading={recurring.isLoading}
            errorMessage={recurring.error?.message ?? null}
            onEdit={editRecurring}
            onDelete={askDeleteRecurring}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>

      <ExpenseFormDialog
        open={expenseForm !== null}
        onOpenChange={(open) => (open ? undefined : setExpenseForm(null))}
        expense={expenseForm === "new" ? null : expenseForm}
      />

      <RecurringFormDialog
        open={recurringForm !== null}
        onOpenChange={(open) => (open ? undefined : setRecurringForm(null))}
        template={recurringForm === "new" ? null : recurringForm}
      />

      <ConfirmDeleteDialog
        open={expenseToDelete !== null}
        onOpenChange={(open) => (open ? undefined : setExpenseToDelete(null))}
        title={`Eliminar «${expenseToDelete?.description ?? ""}»`}
        description="El borrado es definitivo. Queda una copia completa del egreso en la bitácora de auditoría."
        isPending={deleteExpense.isPending}
        errorMessage={deleteExpense.error?.message ?? null}
        onConfirm={confirmDeleteExpense}
      />

      <ConfirmDeleteDialog
        open={recurringToDelete !== null}
        onOpenChange={(open) => (open ? undefined : setRecurringToDelete(null))}
        title={`Eliminar «${recurringToDelete?.description ?? ""}»`}
        description="Dejará de generar egresos. Los ya generados se conservan. Si solo quieres detenerla un tiempo, edítala y desmarca «Activa»."
        isPending={deleteRecurring.isPending}
        errorMessage={deleteRecurring.error?.message ?? null}
        onConfirm={confirmDeleteRecurring}
      />
    </>
  );
}
```

- [ ] **Step 5: Página**

Crea `src/app/(admin)/admin/finance/expenses/page.tsx`:

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { can, PERMISSIONS } from "@/lib/permissions";
import { ExpensesManager } from "@/modules/finance/components/expenses-manager";

export const metadata: Metadata = {
  title: "Egresos",
};

export default async function AdminExpensesPage() {
  const [canRead, canManage] = await Promise.all([
    can(PERMISSIONS.FINANCE_READ),
    can(PERMISSIONS.FINANCE_MANAGE_EXPENSES),
  ]);

  if (!canRead) redirect("/admin");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
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
    </main>
  );
}
```

- [ ] **Step 6: Navegación**

En `src/components/shared/admin-shell.tsx`, agrega "Egresos" tras "Ingresos" en `NAV_ITEMS` (sin gating, mismo criterio D15):

```ts
  { href: "/admin/finance/revenue", label: "Ingresos" },
  { href: "/admin/finance/expenses", label: "Egresos" },
```

- [ ] **Step 7: Verificar tipos y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/modules/finance/components/expense-filters.tsx src/modules/finance/components/expenses-table.tsx src/modules/finance/components/recurring-expenses-table.tsx src/modules/finance/components/expenses-manager.tsx "src/app/(admin)/admin/finance/expenses/" src/components/shared/admin-shell.tsx
git commit -m "feat(finance): add expenses manager, page and nav entry"
```

---

### Task 12: Verificación final, BD real y cierre del spec

**Files:**
- Modify: `docs/specs/017-finance-expenses.md`
- Temporal (no se commitea): `verify-expenses.tmp.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: spec 017 en `status: done`, con los criterios verificados marcados.

- [ ] **Step 1: Verificación estática completa**

Run: `npm run typecheck && npm run lint && npm run build && npm test`
Expected: las cuatro en verde; `npm test` incluye los tests nuevos de `recurring`, `utils`, `expense.schema`, `types/expense` y `expense-range`. Build lista `/admin/finance/expenses` y las 4 rutas `/api/admin/finance/expenses*`/`recurring-expenses*`.

- [ ] **Step 2: Pedir confirmación antes de tocar la BD real**

**Parar y preguntar al usuario** (acción sobre infraestructura compartida): "¿Corro `npm run db:migrate` (crea `expenses`, `recurring_expenses` y el enum en Neon) y `npm run db:seed` (da de alta `finance.manage_expenses` y lo concede a `super_admin`/`admin`)?". Sin un sí explícito, saltar los Steps 3–5 y anotarlo en el ledger como verificación pendiente.

- [ ] **Step 3: Migrar y sembrar**

Run: `npm run db:migrate && npm run db:seed`
Expected: migración aplicada sin error; el seed reporta un permiso más que antes (27 en total: 26 + `finance.manage_expenses`).

- [ ] **Step 4: Verificación contra la BD real (AC7, AC8, AC9, AC11)**

Crea `verify-expenses.tmp.ts` en la raíz del repo:

```ts
import { eq } from "drizzle-orm";

import { closePool, dbTx } from "./src/server/db/pool";
import { expenses, recurringExpenses, users } from "./src/server/db/schema";
import {
  createRecurringExpense,
  ensureRecurringExpenses,
  updateRecurringExpense,
} from "./src/server/services/recurring-expense.service";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

async function main() {
  const [actor] = await dbTx.select().from(users).limit(1);
  if (!actor) throw new Error("Necesito al menos un usuario sembrado.");

  const today = new Date().toISOString().slice(0, 10);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setUTCMonth(threeMonthsAgo.getUTCMonth() - 3);
  const startsOn = threeMonthsAgo.toISOString().slice(0, 10);

  // AC7: alta con día 31 y inicio hace 3 meses.
  const template = await createRecurringExpense(actor, {
    category: "other",
    description: "verify-expenses (temporal)",
    amountCents: 1000,
    dayOfMonth: 31,
    startsOn,
    endsOn: null,
  });

  try {
    const first = await ensureRecurringExpenses(today);
    const generated = await dbTx.select().from(expenses).where(eq(expenses.recurringExpenseId, template.id));
    assert(first === generated.length && generated.length >= 2, `generó ${generated.length} vencimientos ≤ hoy`);
    assert(generated.every((row) => row.incurredOn <= today), "ningún vencimiento en el futuro");

    // AC8: segunda ejecución y ejecución en paralelo no duplican.
    const second = await ensureRecurringExpenses(today);
    assert(second === 0, "segunda ejecución no genera nada");
    await Promise.all([ensureRecurringExpenses(today), ensureRecurringExpenses(today), ensureRecurringExpenses(today)]);
    const afterParallel = await dbTx.select().from(expenses).where(eq(expenses.recurringExpenseId, template.id));
    assert(afterParallel.length === generated.length, "3 ejecuciones en paralelo no duplican");

    // AC9: un egreso generado que se borra no reaparece.
    await dbTx.delete(expenses).where(eq(expenses.id, generated[0].id));
    await ensureRecurringExpenses(today);
    const afterDelete = await dbTx.select().from(expenses).where(eq(expenses.recurringExpenseId, template.id));
    assert(afterDelete.length === generated.length - 1, "el egreso borrado no reaparece");

    // AC11: pausar y reactivar no genera el período en pausa.
    await updateRecurringExpense(actor, template.id, { isActive: false }, today);
    await updateRecurringExpense(actor, template.id, { isActive: true }, today);
    await ensureRecurringExpenses(today);
    const afterReactivate = await dbTx.select().from(expenses).where(eq(expenses.recurringExpenseId, template.id));
    assert(afterReactivate.length === afterDelete.length, "reactivar no genera retroactivo");
  } finally {
    await dbTx.delete(expenses).where(eq(expenses.recurringExpenseId, template.id));
    await dbTx.delete(recurringExpenses).where(eq(recurringExpenses.id, template.id));
    console.log("Limpieza hecha.");
  }
}

main()
  .then(() => closePool())
  .catch(async (error) => {
    console.error(error);
    await closePool();
    process.exit(1);
  });
```

Run: `npx tsx --env-file-if-exists=.env.local verify-expenses.tmp.ts`
Expected: cinco líneas `OK:` y `Limpieza hecha.`; código de salida 0. Cualquier `FAIL:` es un bug real: usar `superpowers:systematic-debugging`, no ajustar el script.

- [ ] **Step 5: Borrar el script temporal**

Run: `rm -f verify-expenses.tmp.ts && git status --short`
Expected: sin archivos sin commitear salvo los del Step 6.

- [ ] **Step 6: Cerrar el spec**

En `docs/specs/017-finance-expenses.md`: cambia `status: draft` a `status: done`; marca `[x]` en los AC verificados (AC1–AC3 y AC6 por estructura del código y tests de schema; AC5 por `expensesQuerySchema`; AC7–AC9 y AC11 por el script del Step 4; AC10 por construcción — `updateRecurringExpense` no toca egresos ya generados; AC12 por `minStartsOn` en `createRecurringExpense`). Deja **sin marcar** AC4 y AC13 con la anotación: "No observado con sesión real de navegador; `requirePermission`/`can()` son las mismas funciones ya usadas por inventario e ingresos." Si se saltó el Step 3, deja también AC7–AC9 y AC11 sin marcar con "verificación contra BD pendiente". Agrega `## Notas de implementación` con: qué patrones se calcaron, el aviso de D12 para la fase 5, y `Verificación final: … N/N`.

- [ ] **Step 7: Commit**

```bash
git add docs/specs/017-finance-expenses.md
git commit -m "docs(finance): close spec 017 — expenses phase 3"
```

---

## Self-Review

**1. Cobertura del spec:** Alcance → Tasks 1 (tablas), 2 (permiso), 7–8 (CRUD/generación/API), 9–11 (UI). D1 → sin tarea (por omisión: no hay categoría de mercadería). D2 → Tasks 1 y 4. D3 → Task 7 (`deleteExpense` con foto en `changes.before`). D4 → Task 3 (`occurrenceDate`). D5/D6 → Tasks 3, 6, 7. D7 → Task 7 (`updateRecurringExpense`) y Task 4 (`strictObject` sin `startsOn`). D8 → Tasks 3 (`minStartsOn`), 7 y 10 (aviso de relleno). D9 → Global Constraints + Tasks 3–5. D10 → Task 2. D11 → sin columna de moneda (Task 1). D12 → comentario de `ensureRecurringExpenses` y `listExpenses`/`listRecurringExpenses`. API → Task 8. UI → Tasks 10–11. AC1–AC13 → ver Task 12 Step 6.

**2. Placeholders:** ninguno.

**3. Consistencia de tipos:** `RecurrenceWindow`/`dueOccurrences`/`lastOccurrenceOnOrBefore`/`nextDueOn`/`minStartsOn`/`toUtcDateString` (Task 3) se usan igual en Tasks 5, 7, 8 y 10. `ExpenseCategoryValue`/`EXPENSE_CATEGORY_VALUES` (Task 4) en Tasks 5, 7, 10, 11; `ExpenseCategory` (Task 1) solo en servidor y fijado por `categoriesInSync` (Task 7). `ExpensesQuery` (Task 4) = argumento de `listExpenses` (Task 7, `ListExpensesParams` estructuralmente idéntico: `from`,`to`,`category?`,`page`,`pageSize`). `ExpenseDto`/`RecurringExpenseDto`/`ExpenseListResponse` (Task 5) en Tasks 8–11. `ExpenseFilters` (Task 4) en Tasks 9 y 11; `RevenueRangePicker` recibe `filters: RevenueFilters`, que `ExpenseFilters` satisface por ser una extensión.

**4. Review Focus:** los cinco puntos tienen dueño (Tasks 3, 12, 3, 3+12, 5).
