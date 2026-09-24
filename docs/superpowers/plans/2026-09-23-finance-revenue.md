# Finanzas — Fase 2: Ingresos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reporte de Ingresos en `/admin/finance/revenue`: ingresos totales, margen bruto real (con su % de cobertura) y desglose por categoría, para un rango de fechas con presets de negocio o calendario libre.

**Architecture:** Sin esquema nuevo. Una función de repositorio nueva (`getRevenueByCategory`) junto a las ya existentes `getSalesSummary`/`getDailySales` (013), orquestadas por un servicio nuevo `server/services/revenue.service.ts`. Funciones puras nuevas en `src/modules/finance/utils.ts` (cobertura de margen, zero-fill de rango libre, resolución de presets). UI calcada del patrón `DashboardManager`/`SalesTrendChart` ya existente, con `Calendar`/`Popover` ya instalados para el rango libre.

**Tech Stack:** Next.js 16 (Route Handlers) · Drizzle ORM / Neon Postgres · Zod · TanStack Query v5 · Recharts (wrapper `chart.tsx`) · `react-day-picker` (`Calendar`) · Node test runner.

**Spec:** `docs/specs/016-finance-revenue.md`

## Global Constraints

- Precios en centavos enteros; nunca `float`.
- TypeScript estricto: cero `any`, cero `@ts-ignore`.
- Un componente nunca importa `db`, Drizzle ni un repositorio directamente.
- Un componente nunca llama `axios`/`fetch` directo: va en `services/` del módulo, se consume vía hook.
- Toda consulta a BD vive en `src/server/repositories/`.
- Todo Route Handler valida su entrada con Zod antes de tocar datos.
- La autorización siempre pasa por `requirePermission(PERMISSIONS.*)` / `can()`; nunca se compara `role === '...'`.
- Ningún archivo que deba correr bajo `node --test` importa un **valor** (no un `import type`) a través de un alias `@/` de otro módulo — `node --test` no resuelve esos imports (015, revisión final, hallazgo I2). Los tipos compartidos se duplican a propósito cuando hace falta (mismo criterio que `STOCK_MOVEMENT_TYPE_VALUES` en `inventory.schema.ts`).
- Sin permiso nuevo esta fase: reutiliza `finance.read` (015 D4 ya lo preveía).
- Verificación final: `npm run typecheck && npm run lint && npm run build && npm test`.

## Review Focus

- Cobertura de margen 0% en el rango: `marginCents` debe viajar `null`, nunca `0` — pinneado en Task 2.
- `to < from` en la query: debe responder 400, no un rango invertido silencioso — pinneado en Task 3.
- Preset "Mes pasado": debe ser el mes calendario **completo** anterior, no "los últimos 30 días" — pinneado en Task 2.
- Una categoría sin ninguna línea con costo conocido: su margen debe mostrarse como "Sin datos suficientes", nunca `0` ni `NaN` — pinneado en Tasks 4 y 10.
- Rango libre a medio elegir (solo `from`, sin `to` todavía): no debe disparar el request ni romper la UI — pinneado en Task 7 (sin test automatizado: los hooks quedan fuera del alcance de unit testing del proyecto, `docs/testing/unit-test-candidates.md`; se verifica por construcción con `enabled: query !== null`, mismo patrón que `useStockMovements`).

---

### Task 1: Repositorio — ingresos por categoría

**Files:**
- Modify: `src/server/repositories/order.repository.ts`

**Interfaces:**
- Consumes: `categories`, `products` (schema, ya existen); `settledInRange` (función privada ya existente en este archivo, no exportada — se reutiliza tal cual).
- Produces: `orderRepository.getRevenueByCategory(from: Date, to: Date, executor?): Promise<CategoryRevenueRow[]>`, tipo `CategoryRevenueRow`.

- [ ] **Step 1: Ampliar los imports del schema**

En `src/server/repositories/order.repository.ts`, el import de `@/server/db/schema` actualmente trae `orderItems, orders, users` y tipos. Agrega `categories` y `products`:

```ts
import {
  categories,
  orderItems,
  orders,
  products,
  users,
  type NewOrder,
  type NewOrderItem,
  type Order,
  type OrderItem,
  type OrderStatus,
  type User,
} from "@/server/db/schema";
```

- [ ] **Step 2: Agregar `getRevenueByCategory` al final del archivo**

```ts
export type CategoryRevenueRow = {
  categoryId: string;
  categoryName: string;
  /** Ingresos totales de la categoría, tengan o no costo conocido las líneas. */
  revenueCents: number;
  units: number;
  /** Suma de margen solo en líneas con `cost_cents_snapshot` no nulo (016 D2). */
  marginCentsKnown: number;
  /** Ingresos de esas mismas líneas — la base para calcular % de cobertura. */
  revenueCentsKnown: number;
};

/**
 * Desglose por categoría del reporte de Ingresos (016). `revenueCents`/`units`
 * cuentan el 100% de las líneas del rango; `marginCentsKnown`/`revenueCentsKnown`
 * solo las que tienen costo congelado, con `filter (where ...)` en la misma
 * agregación — mismo estilo que `getFacetCounts` en `product.repository.ts`,
 * sin una segunda consulta ni una lectura por fila.
 */
export async function getRevenueByCategory(
  from: Date,
  to: Date,
  executor: ReadExecutor = db,
): Promise<CategoryRevenueRow[]> {
  const revenueExpr = sql<number>`${orderItems.unitPriceCents} * ${orderItems.qty}`;
  const marginExpr = sql<number>`(${orderItems.unitPriceCents} - ${orderItems.costCentsSnapshot}) * ${orderItems.qty}`;
  const hasCost = sql`${orderItems.costCentsSnapshot} is not null`;

  return executor
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      revenueCents: sql<number>`coalesce(sum(${revenueExpr}), 0)::int`,
      units: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int`,
      marginCentsKnown: sql<number>`coalesce(sum(${marginExpr}) filter (where ${hasCost}), 0)::int`,
      revenueCentsKnown: sql<number>`coalesce(sum(${revenueExpr}) filter (where ${hasCost}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(settledInRange(from, to))
    .groupBy(categories.id, categories.name)
    .orderBy(desc(sql`sum(${revenueExpr})`));
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores. `desc`, `eq`, `sql`, `db`, `ReadExecutor` ya están importados en el archivo.

- [ ] **Step 4: Commit**

```bash
git add src/server/repositories/order.repository.ts
git commit -m "feat(finance): add getRevenueByCategory to order repository"
```

---

### Task 2: Funciones puras del reporte

**Files:**
- Modify: `src/modules/finance/utils.ts`
- Modify: `src/modules/finance/utils.test.ts`

**Interfaces:**
- Consumes: nada (funciones puras).
- Produces: `resolveMarginCoverage(marginCentsKnown, revenueCentsKnown, totalRevenueCents): MarginCoverage`; `DailyRevenuePoint` (tipo); `fillMissingDaysInRange(from: Date, to: Date, rows: { date: string; salesCents: number }[]): DailyRevenuePoint[]`; `REVENUE_RANGE_PRESETS`, tipo `RevenueRangePreset`; `resolveDateRangePreset(preset: RevenueRangePreset, now?: Date): { from: string; to: string }`.

- [ ] **Step 1: Escribir los tests que fallan**

Agrega al final de `src/modules/finance/utils.test.ts` (el archivo ya existe con el `describe("computeMargin")` de la Fase 1; no lo borres):

```ts
import {
  computeMargin,
  fillMissingDaysInRange,
  resolveDateRangePreset,
  resolveMarginCoverage,
} from "./utils.ts";

describe("resolveMarginCoverage", () => {
  it("returns null margin and 0% coverage when nothing has a known cost", () => {
    assert.deepEqual(resolveMarginCoverage(0, 0, 50000), { marginCents: null, marginCoveragePercent: 0 });
  });

  it("returns full coverage when every cent of revenue has a known cost", () => {
    assert.deepEqual(resolveMarginCoverage(20000, 50000, 50000), {
      marginCents: 20000,
      marginCoveragePercent: 100,
    });
  });

  it("computes partial coverage rounded to one decimal", () => {
    assert.deepEqual(resolveMarginCoverage(10000, 25000, 75000), {
      marginCents: 10000,
      marginCoveragePercent: 33.3,
    });
  });

  it("treats zero total revenue as 0% coverage without dividing by zero", () => {
    assert.deepEqual(resolveMarginCoverage(0, 0, 0), { marginCents: null, marginCoveragePercent: 0 });
  });
});

describe("fillMissingDaysInRange", () => {
  it("fills every day of a 3-day range with 0 when there are no rows", () => {
    const from = new Date(Date.UTC(2026, 2, 1));
    const to = new Date(Date.UTC(2026, 2, 3));

    assert.deepEqual(fillMissingDaysInRange(from, to, []), [
      { date: "2026-03-01", revenueCents: 0 },
      { date: "2026-03-02", revenueCents: 0 },
      { date: "2026-03-03", revenueCents: 0 },
    ]);
  });

  it("keeps the known days and zero-fills the gaps", () => {
    const from = new Date(Date.UTC(2026, 2, 1));
    const to = new Date(Date.UTC(2026, 2, 3));
    const rows = [{ date: "2026-03-02", salesCents: 5000 }];

    assert.deepEqual(fillMissingDaysInRange(from, to, rows), [
      { date: "2026-03-01", revenueCents: 0 },
      { date: "2026-03-02", revenueCents: 5000 },
      { date: "2026-03-03", revenueCents: 0 },
    ]);
  });

  it("returns a single point for a same-day range", () => {
    const day = new Date(Date.UTC(2026, 2, 1));

    assert.deepEqual(fillMissingDaysInRange(day, day, []), [{ date: "2026-03-01", revenueCents: 0 }]);
  });
});

describe("resolveDateRangePreset", () => {
  it("resolves 'this_month' from day 1 (local) to now", () => {
    const now = new Date(2026, 2, 15, 10, 30);

    assert.deepEqual(resolveDateRangePreset("this_month", now), {
      from: new Date(2026, 2, 1).toISOString(),
      to: now.toISOString(),
    });
  });

  it("resolves 'last_month' as the full previous calendar month, not a rolling window", () => {
    const now = new Date(2026, 2, 15);

    assert.deepEqual(resolveDateRangePreset("last_month", now), {
      from: new Date(2026, 1, 1).toISOString(),
      to: new Date(2026, 2, 1).toISOString(),
    });
  });

  it("resolves 'last_month' across a year boundary", () => {
    const now = new Date(2026, 0, 20);

    assert.deepEqual(resolveDateRangePreset("last_month", now), {
      from: new Date(2025, 11, 1).toISOString(),
      to: new Date(2026, 0, 1).toISOString(),
    });
  });

  it("resolves 'this_quarter' to the start of the current quarter", () => {
    const now = new Date(2026, 7, 10);

    assert.deepEqual(resolveDateRangePreset("this_quarter", now), {
      from: new Date(2026, 6, 1).toISOString(),
      to: now.toISOString(),
    });
  });

  it("resolves 'this_year' to January 1st", () => {
    const now = new Date(2026, 10, 1);

    assert.deepEqual(resolveDateRangePreset("this_year", now), {
      from: new Date(2026, 0, 1).toISOString(),
      to: now.toISOString(),
    });
  });
});
```

(El `describe("computeMargin")` que ya existe en el archivo queda intacto arriba de estos.)

- [ ] **Step 2: Ejecutar los tests y confirmar que fallan**

Run: `node --test "src/modules/finance/utils.test.ts"`
Expected: FAIL — `resolveMarginCoverage`/`fillMissingDaysInRange`/`resolveDateRangePreset` no existen todavía en `./utils.ts`.

- [ ] **Step 3: Implementar**

Agrega al final de `src/modules/finance/utils.ts` (después de `computeMargin`, que queda igual):

```ts
export type MarginCoverage = { marginCents: number | null; marginCoveragePercent: number };

/**
 * Margen y cobertura del reporte de Ingresos (016 D2), a partir de dos sumas
 * agregadas: cuánto ingreso vino de líneas con costo conocido
 * (`revenueCentsKnown`) y cuánto margen dejaron esas líneas
 * (`marginCentsKnown`). Sin cobertura, `marginCents` es `null` — un margen de
 * `0` sería indistinguible de "no sé", mismo criterio que `computeMargin`.
 */
export function resolveMarginCoverage(
  marginCentsKnown: number,
  revenueCentsKnown: number,
  totalRevenueCents: number,
): MarginCoverage {
  if (revenueCentsKnown === 0) return { marginCents: null, marginCoveragePercent: 0 };

  const marginCoveragePercent =
    totalRevenueCents === 0 ? 0 : Math.round((revenueCentsKnown / totalRevenueCents) * 1000) / 10;

  return { marginCents: marginCentsKnown, marginCoveragePercent };
}

export type DailyRevenuePoint = { date: string; revenueCents: number };

/** `YYYY-MM-DD` en UTC, misma clave que `getDailySales` (013 D3). */
function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Zero-fill para un rango libre (016 D5): variante de `fillMissingDays` del
 * dashboard (013), que solo aceptaba 7/30/90 días fijos. Aquí el número de
 * días sale de `from`/`to`, calculado en UTC para no correrse un día.
 */
export function fillMissingDaysInRange(
  from: Date,
  to: Date,
  rows: { date: string; salesCents: number }[],
): DailyRevenuePoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row.salesCents]));
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

  return Array.from({ length: Math.max(dayCount, 0) }, (_, offset) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + offset);

    const date = toDayKey(day);
    return { date, revenueCents: byDate.get(date) ?? 0 };
  });
}

export const REVENUE_RANGE_PRESETS = ["this_month", "last_month", "this_quarter", "this_year"] as const;

export type RevenueRangePreset = (typeof REVENUE_RANGE_PRESETS)[number];

/**
 * Traduce un preset de negocio a fechas concretas en hora **local** (016 D3),
 * mismo criterio que `currentMonthRange()` en `orders/hooks/use-my-orders.ts`.
 * Los presets "en curso" (`this_month`/`this_quarter`/`this_year`) llegan
 * hasta `now`; `last_month` es un período cerrado completo. `now` es
 * inyectable para pruebas deterministas, mismo patrón que `isExpired` en
 * `payment-methods/constants.ts`.
 */
export function resolveDateRangePreset(
  preset: RevenueRangePreset,
  now: Date = new Date(),
): { from: string; to: string } {
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case "this_month":
      return { from: new Date(year, month, 1).toISOString(), to: now.toISOString() };
    case "last_month":
      return {
        from: new Date(year, month - 1, 1).toISOString(),
        to: new Date(year, month, 1).toISOString(),
      };
    case "this_quarter": {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      return { from: new Date(year, quarterStartMonth, 1).toISOString(), to: now.toISOString() };
    }
    case "this_year":
      return { from: new Date(year, 0, 1).toISOString(), to: now.toISOString() };
  }
}
```

- [ ] **Step 4: Ejecutar los tests y confirmar que pasan**

Run: `node --test "src/modules/finance/utils.test.ts"`
Expected: PASS, 16/16 (6 de `computeMargin` + 4 de `resolveMarginCoverage` + 3 de `fillMissingDaysInRange` + 5 de `resolveDateRangePreset`).

Nota: si tu máquina corre en una zona horaria con DST activo en alguna de las fechas de prueba, el test seguirá pasando igual — construye el valor esperado con el mismo constructor `new Date(year, month, day)` que la implementación, así que ambos lados se corren igual.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/utils.ts src/modules/finance/utils.test.ts
git commit -m "feat(finance): add margin coverage, date-range zero-fill and preset resolution"
```

---

### Task 3: Schemas Zod

**Files:**
- Create: `src/modules/finance/schemas/revenue.schema.ts`
- Test: `src/modules/finance/schemas/revenue.schema.test.ts`

**Interfaces:**
- Consumes: nada (Zod puro; sin imports de valor cruzados — mismo motivo que `unit-price.schema.ts`).
- Produces: `revenueQuerySchema`, `RevenueQuery` (server); `REVENUE_FILTER_PRESETS`, `RevenueFilterPreset`, `revenueFiltersSchema`, `RevenueFilters` (cliente).

- [ ] **Step 1: Escribir el test que falla**

Crea `src/modules/finance/schemas/revenue.schema.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { revenueFiltersSchema, revenueQuerySchema } from "./revenue.schema.ts";

describe("revenueQuerySchema", () => {
  it("accepts a valid from/to range", () => {
    const result = revenueQuerySchema.safeParse({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.999Z",
    });
    assert.equal(result.success, true);
  });

  it("rejects when to is before from", () => {
    const result = revenueQuerySchema.safeParse({
      from: "2026-03-31T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
    });
    assert.equal(result.success, false);
  });

  it("rejects a missing from", () => {
    assert.equal(revenueQuerySchema.safeParse({ to: "2026-03-31T00:00:00.000Z" }).success, false);
  });

  it("rejects a non-ISO date string", () => {
    assert.equal(
      revenueQuerySchema.safeParse({ from: "not-a-date", to: "2026-03-31T00:00:00.000Z" }).success,
      false,
    );
  });
});

describe("revenueFiltersSchema", () => {
  it("defaults preset to 'this_month' when absent", () => {
    const result = revenueFiltersSchema.safeParse({});
    assert.equal(result.success, true);
    assert.equal(result.data?.preset, "this_month");
  });

  it("accepts a custom preset with from/to", () => {
    const result = revenueFiltersSchema.safeParse({
      preset: "custom",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-15T00:00:00.000Z",
    });
    assert.equal(result.success, true);
  });

  it("accepts a custom preset with no from/to yet (range not picked)", () => {
    assert.equal(revenueFiltersSchema.safeParse({ preset: "custom" }).success, true);
  });
});
```

- [ ] **Step 2: Ejecutar el test y confirmar que falla**

Run: `node --test "src/modules/finance/schemas/revenue.schema.test.ts"`
Expected: FAIL — `Cannot find module './revenue.schema.ts'`.

- [ ] **Step 3: Implementar**

Crea `src/modules/finance/schemas/revenue.schema.ts`:

```ts
import { z } from "zod";

/**
 * Entrada de `GET /api/admin/finance/revenue`. Ambos campos son requeridos a
 * propósito (016 D3): un reporte financiero nunca corre con un rango
 * implícito. El cliente siempre resuelve el preset a fechas concretas antes
 * de pedir — el servidor no conoce el preset.
 */
export const revenueQuerySchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
  })
  .superRefine((values, ctx) => {
    if (new Date(values.to) < new Date(values.from)) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "El fin del rango no puede ser anterior al inicio.",
      });
    }
  });

export type RevenueQuery = z.infer<typeof revenueQuerySchema>;

/**
 * Duplicado a propósito de `REVENUE_RANGE_PRESETS` (`modules/finance/utils.ts`)
 * más `"custom"`: este archivo lo importa un componente cliente vía valor
 * (`revenueFiltersSchema` se ejecuta en el navegador), así que no puede
 * depender de un import cruzado de otro módulo bajo `node --test` — mismo
 * criterio que `STOCK_MOVEMENT_TYPE_VALUES` en `inventory.schema.ts`.
 */
export const REVENUE_FILTER_PRESETS = [
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
  "custom",
] as const;

export type RevenueFilterPreset = (typeof REVENUE_FILTER_PRESETS)[number];

/** Estado del filtro tal como viaja en la URL del cliente; nunca cruza a la API. */
export const revenueFiltersSchema = z.object({
  preset: z.enum(REVENUE_FILTER_PRESETS).default("this_month"),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export type RevenueFilters = z.infer<typeof revenueFiltersSchema>;
```

- [ ] **Step 4: Ejecutar el test y confirmar que pasa**

Run: `node --test "src/modules/finance/schemas/revenue.schema.test.ts"`
Expected: PASS, 7/7.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/schemas/revenue.schema.ts src/modules/finance/schemas/revenue.schema.test.ts
git commit -m "feat(finance): add revenue query and client filter schemas"
```

---

### Task 4: DTO y mapeo por categoría

**Files:**
- Create: `src/modules/finance/types/revenue.ts`
- Test: `src/modules/finance/types/revenue.test.ts`

**Interfaces:**
- Consumes: `CategoryRevenueRow` (Task 1, type-only); `resolveMarginCoverage` (Task 2).
- Produces: `CategoryRevenueDto`, `RevenueSummaryDto`, `toCategoryRevenueDto(row: CategoryRevenueRow): CategoryRevenueDto`.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/modules/finance/types/revenue.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toCategoryRevenueDto } from "./revenue.ts";

describe("toCategoryRevenueDto", () => {
  it("shows 'no coverage' as a null margin, not zero", () => {
    const dto = toCategoryRevenueDto({
      categoryId: "c1",
      categoryName: "Audio",
      revenueCents: 10000,
      units: 3,
      marginCentsKnown: 0,
      revenueCentsKnown: 0,
    });

    assert.deepEqual(dto, { categoryId: "c1", categoryName: "Audio", revenueCents: 10000, marginCents: null, units: 3 });
  });

  it("keeps the known margin when the category has full coverage", () => {
    const dto = toCategoryRevenueDto({
      categoryId: "c2",
      categoryName: "Video",
      revenueCents: 20000,
      units: 5,
      marginCentsKnown: 8000,
      revenueCentsKnown: 20000,
    });

    assert.equal(dto.marginCents, 8000);
  });
});
```

- [ ] **Step 2: Ejecutar el test y confirmar que falla**

Run: `node --test "src/modules/finance/types/revenue.test.ts"`
Expected: FAIL — `Cannot find module './revenue.ts'`.

- [ ] **Step 3: Implementar**

Crea `src/modules/finance/types/revenue.ts`:

```ts
import { resolveMarginCoverage } from "@/modules/finance/utils";
import type { CategoryRevenueRow } from "@/server/repositories/order.repository";
import type { DailyRevenuePoint } from "@/modules/finance/utils";

export type CategoryRevenueDto = {
  categoryId: string;
  categoryName: string;
  revenueCents: number;
  /** `null` = ninguna línea de esta categoría tiene costo conocido (016 D4). */
  marginCents: number | null;
  units: number;
};

export type RevenueSummaryDto = {
  from: string;
  to: string;
  revenueCents: number;
  ordersCount: number;
  marginCents: number | null;
  marginCoveragePercent: number;
  dailyRevenue: DailyRevenuePoint[];
  byCategory: CategoryRevenueDto[];
};

export function toCategoryRevenueDto(row: CategoryRevenueRow): CategoryRevenueDto {
  const { marginCents } = resolveMarginCoverage(row.marginCentsKnown, row.revenueCentsKnown, row.revenueCents);

  return {
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    revenueCents: row.revenueCents,
    marginCents,
    units: row.units,
  };
}
```

- [ ] **Step 4: Ejecutar el test y confirmar que pasa**

Run: `node --test "src/modules/finance/types/revenue.test.ts"`
Expected: PASS, 2/2.

- [ ] **Step 5: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/types/revenue.ts src/modules/finance/types/revenue.test.ts
git commit -m "feat(finance): add revenue DTOs and category margin mapping"
```

---

### Task 5: Servicio de servidor — orquestación

**Files:**
- Create: `src/server/services/revenue.service.ts`

**Interfaces:**
- Consumes: `orderRepository.getSalesSummary`, `orderRepository.getDailySales` (013, sin cambios), `orderRepository.getRevenueByCategory` (Task 1); `fillMissingDaysInRange`, `resolveMarginCoverage` (Task 2); `toCategoryRevenueDto`, `RevenueSummaryDto` (Task 4).
- Produces: `getRevenueSummary(from: Date, to: Date): Promise<RevenueSummaryDto>`.

- [ ] **Step 1: Crear el servicio**

Crea `src/server/services/revenue.service.ts`:

```ts
import { fillMissingDaysInRange, resolveMarginCoverage } from "@/modules/finance/utils";
import { toCategoryRevenueDto, type RevenueSummaryDto } from "@/modules/finance/types/revenue";
import * as orderRepository from "@/server/repositories/order.repository";

/**
 * Orquesta las 3 lecturas del reporte de Ingresos (016) en paralelo, sin N+1:
 * el total sale de `getSalesSummary` (013, órdenes) y la serie diaria de
 * `getDailySales` (013, sin cambios: ya acepta cualquier rango, no solo
 * 7/30/90). El margen global se deriva sumando las columnas "conocidas" de
 * cada categoría — no hace falta una cuarta consulta.
 */
export async function getRevenueSummary(from: Date, to: Date): Promise<RevenueSummaryDto> {
  const [summary, dailySales, byCategoryRows] = await Promise.all([
    orderRepository.getSalesSummary(from, to),
    orderRepository.getDailySales(from, to),
    orderRepository.getRevenueByCategory(from, to),
  ]);

  const revenueCentsKnown = byCategoryRows.reduce((total, row) => total + row.revenueCentsKnown, 0);
  const marginCentsKnown = byCategoryRows.reduce((total, row) => total + row.marginCentsKnown, 0);

  const { marginCents, marginCoveragePercent } = resolveMarginCoverage(
    marginCentsKnown,
    revenueCentsKnown,
    summary.salesCents,
  );

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    revenueCents: summary.salesCents,
    ordersCount: summary.ordersCount,
    marginCents,
    marginCoveragePercent,
    dailyRevenue: fillMissingDaysInRange(from, to, dailySales),
    byCategory: byCategoryRows.map(toCategoryRevenueDto),
  };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/revenue.service.ts
git commit -m "feat(finance): add revenue summary orchestration service"
```

---

### Task 6: Route handler

**Files:**
- Create: `src/app/api/admin/finance/revenue/route.ts`

**Interfaces:**
- Consumes: `requirePermission`, `PERMISSIONS.FINANCE_READ` (`@/lib/permissions`); `revenueQuerySchema` (Task 3); `RevenueSummaryDto` (Task 4); `getRevenueSummary` (Task 5); `toErrorResponse` (`@/lib/api-error`).
- Produces: `GET /api/admin/finance/revenue`.

- [ ] **Step 1: Crear el handler**

Crea `src/app/api/admin/finance/revenue/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { revenueQuerySchema } from "@/modules/finance/schemas/revenue.schema";
import type { RevenueSummaryDto } from "@/modules/finance/types/revenue";
import { getRevenueSummary } from "@/server/services/revenue.service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const query = revenueQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const summary = await getRevenueSummary(new Date(query.from), new Date(query.to));

    return NextResponse.json<RevenueSummaryDto>(summary);
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Verificación manual (sin sesión disponible en esta sesión de ejecución — ver Review Focus del plan de la Fase 1 para el mismo límite)**

Con `npm run dev` arriba:

```bash
curl -i "http://localhost:3000/api/admin/finance/revenue?from=2026-01-01T00:00:00.000Z&to=2026-01-31T00:00:00.000Z"
```

Expected: `401` sin cookie de sesión (mismo comportamiento que `/api/admin/finance/unit-price`, protegido por el middleware sin tocarlo).

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/admin/finance/revenue/"
git commit -m "feat(finance): add revenue summary route handler"
```

---

### Task 7: Servicio cliente y hooks

**Files:**
- Create: `src/modules/finance/services/revenue.service.ts`
- Create: `src/modules/finance/hooks/use-revenue.ts`

**Interfaces:**
- Consumes: `api` (`@/lib/axios`); `RevenueQuery`, `RevenueFilters`, `RevenueFilterPreset`, `revenueFiltersSchema` (Task 3); `RevenueSummaryDto` (Task 4); `resolveDateRangePreset`, `RevenueRangePreset` (Task 2).
- Produces: `fetchRevenueSummary(query): Promise<RevenueSummaryDto>`; `useRevenueFilters()`, `useRevenue(query)`, `revenueKeys`.

- [ ] **Step 1: Servicio axios**

Crea `src/modules/finance/services/revenue.service.ts`:

```ts
import { api } from "@/lib/axios";
import type { RevenueQuery } from "@/modules/finance/schemas/revenue.schema";
import type { RevenueSummaryDto } from "@/modules/finance/types/revenue";

export async function fetchRevenueSummary(query: RevenueQuery): Promise<RevenueSummaryDto> {
  const { data } = await api.get<RevenueSummaryDto>("/admin/finance/revenue", { params: query });
  return data;
}
```

- [ ] **Step 2: Hooks**

Crea `src/modules/finance/hooks/use-revenue.ts`:

```ts
"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  revenueFiltersSchema,
  type RevenueFilterPreset,
  type RevenueFilters,
  type RevenueQuery,
} from "@/modules/finance/schemas/revenue.schema";
import { fetchRevenueSummary } from "@/modules/finance/services/revenue.service";
import { resolveDateRangePreset, type RevenueRangePreset } from "@/modules/finance/utils";

export const revenueKeys = {
  all: ["finance", "revenue"] as const,
  summary: (query: RevenueQuery) => [...revenueKeys.all, "summary", query] as const,
};

const DEFAULT_FILTERS: RevenueFilters = { preset: "this_month" };

/**
 * Traduce el filtro (preset o rango libre) a la query concreta que espera la
 * API, o `null` si el rango libre todavía no está completo (016 D3): elegir
 * "custom" no dispara nada hasta tener `from` y `to`.
 */
function resolveQuery(filters: RevenueFilters): RevenueQuery | null {
  if (filters.preset === "custom") {
    if (!filters.from || !filters.to) return null;
    return { from: filters.from, to: filters.to };
  }

  return resolveDateRangePreset(filters.preset as RevenueRangePreset);
}

/** Única traducción entre la URL y `revenueFiltersSchema`, mismo patrón que `useOrderFilters`. */
export function useRevenueFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<RevenueFilters>(() => {
    const parsed = revenueFiltersSchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_FILTERS;
  }, [searchParams]);

  const query = useMemo(() => resolveQuery(filters), [filters]);

  const push = useCallback(
    (next: RevenueFilters) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") continue;
        params.set(key, String(value));
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const setPreset = useCallback(
    (preset: RevenueFilterPreset) => push(preset === "custom" ? { ...filters, preset } : { preset }),
    [filters, push],
  );

  const setCustomRange = useCallback(
    (range: { from?: string; to?: string }) => push({ preset: "custom", ...range }),
    [push],
  );

  return { filters, query, setPreset, setCustomRange };
}

export function useRevenue(query: RevenueQuery | null) {
  return useQuery({
    queryKey: query ? revenueKeys.summary(query) : revenueKeys.all,
    queryFn: () => fetchRevenueSummary(query as RevenueQuery),
    enabled: query !== null,
  });
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/finance/services/revenue.service.ts src/modules/finance/hooks/use-revenue.ts
git commit -m "feat(finance): add revenue axios service and TanStack Query hooks"
```

---

### Task 8: UI — selector de rango

**Files:**
- Create: `src/modules/finance/components/revenue-range-picker.tsx`

**Interfaces:**
- Consumes: `REVENUE_RANGE_PRESETS` (Task 2); `RevenueFilterPreset`, `RevenueFilters` (Task 3); `Button`, `Calendar`, `Popover`/`PopoverContent`/`PopoverTrigger` (shadcn, ya instalados).
- Produces: `RevenueRangePicker` (componente React).

- [ ] **Step 1: Crear el componente**

Crea `src/modules/finance/components/revenue-range-picker.tsx` (calco de `order-history-filters.tsx`, con presets de negocio en vez de "Mes actual"/"Rango"):

```tsx
"use client";

import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RevenueFilterPreset, RevenueFilters } from "@/modules/finance/schemas/revenue.schema";
import { REVENUE_RANGE_PRESETS } from "@/modules/finance/utils";

type RevenueRangePickerProps = {
  filters: RevenueFilters;
  onPresetChange: (preset: RevenueFilterPreset) => void;
  onCustomRangeChange: (range: { from?: string; to?: string }) => void;
};

const PRESET_LABEL: Record<(typeof REVENUE_RANGE_PRESETS)[number], string> = {
  this_month: "Este mes",
  last_month: "Mes pasado",
  this_quarter: "Este trimestre",
  this_year: "Este año",
};

function formatRange(from?: string, to?: string): string {
  if (!from && !to) return "Rango libre…";

  const start = from ? new Date(from).toLocaleDateString("es") : "…";
  const end = to ? new Date(to).toLocaleDateString("es") : "…";

  return `${start} – ${end}`;
}

/**
 * El día elegido como fin se toma completo: el calendario devuelve las 00:00,
 * y con eso una venta de esa misma tarde quedaría fuera del rango — mismo
 * criterio que `order-history-filters.tsx`.
 */
function toEndOfDay(date: Date): string {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

export function RevenueRangePicker({ filters, onPresetChange, onCustomRangeChange }: RevenueRangePickerProps) {
  const isCustom = filters.preset === "custom";

  const range = {
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Rango de fechas de ingresos"
        className="bg-muted inline-flex items-center gap-1 rounded-lg p-1"
      >
        {REVENUE_RANGE_PRESETS.map((preset) => (
          <Button
            key={preset}
            size="sm"
            variant={filters.preset === preset ? "default" : "ghost"}
            aria-pressed={filters.preset === preset}
            onClick={() => onPresetChange(preset)}
          >
            {PRESET_LABEL[preset]}
          </Button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              variant={isCustom ? "default" : "outline"}
              aria-pressed={isCustom}
              className="justify-start font-normal"
            >
              <CalendarIcon className="size-4" />
              {formatRange(filters.from, filters.to)}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="range"
            selected={range.from || range.to ? range : undefined}
            onSelect={(selected) =>
              onCustomRangeChange({
                from: selected?.from?.toISOString(),
                to: selected?.to ? toEndOfDay(selected.to) : undefined,
              })
            }
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/components/revenue-range-picker.tsx
git commit -m "feat(finance): add revenue date range picker"
```

---

### Task 9: UI — KPIs y tendencia diaria

**Files:**
- Create: `src/modules/finance/components/revenue-kpi-cards.tsx`
- Create: `src/modules/finance/components/revenue-trend-chart.tsx`

**Interfaces:**
- Consumes: `DailyRevenuePoint` (Task 2, type-only); `formatPriceFromCents` (`@/lib/utils`); `Card`/`CardHeader`/`CardTitle`/`CardDescription`, `ChartContainer`/`ChartTooltip`/`ChartTooltipContent` (shadcn, ya instalados).
- Produces: `RevenueKpiCards`, `RevenueTrendChart` (componentes React).

- [ ] **Step 1: KPI cards**

Crea `src/modules/finance/components/revenue-kpi-cards.tsx`:

```tsx
import { PercentIcon, TrendingUpIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPriceFromCents } from "@/lib/utils";

type RevenueKpiCardsProps = {
  revenueCents: number;
  ordersCount: number;
  marginCents: number | null;
  marginCoveragePercent: number;
};

export function RevenueKpiCards({
  revenueCents,
  ordersCount,
  marginCents,
  marginCoveragePercent,
}: RevenueKpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardDescription>Ingresos</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl tabular-nums">
            <TrendingUpIcon className="text-brand size-5" />
            {formatPriceFromCents(revenueCents)}
          </CardTitle>
          <CardDescription className="text-xs">{ordersCount} pedido(s)</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Margen bruto</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl tabular-nums">
            <PercentIcon className="text-muted-foreground size-5" />
            {marginCents === null ? "Sin dato" : formatPriceFromCents(marginCents)}
          </CardTitle>
          <CardDescription className="text-xs">
            {marginCoveragePercent}% de los ingresos con costo conocido
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Gráfico de tendencia**

Crea `src/modules/finance/components/revenue-trend-chart.tsx`:

```tsx
"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPriceFromCents } from "@/lib/utils";
import type { DailyRevenuePoint } from "@/modules/finance/utils";

type RevenueTrendChartProps = { data: DailyRevenuePoint[] };

/** `--brand` (013 D10): es la métrica protagonista del reporte. */
const chartConfig = {
  revenueCents: { label: "Ingresos", color: "var(--brand)" },
} satisfies ChartConfig;

function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  const hasRevenue = data.some((point) => point.revenueCents > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos por día</CardTitle>
        <CardDescription>Pedidos cobrados en el rango elegido</CardDescription>
      </CardHeader>

      {hasRevenue ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full px-2">
          <LineChart accessibilityLayer data={data} margin={{ top: 8, right: 16, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              tickFormatter={(value) => formatDayLabel(String(value))}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(value) => formatPriceFromCents(Number(value))}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => formatDayLabel(String(label))}
                  formatter={(value) => formatPriceFromCents(Number(value))}
                />
              }
            />
            <Line
              dataKey="revenueCents"
              type="monotone"
              stroke="var(--brand)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <p className="text-muted-foreground flex h-64 items-center justify-center text-sm">
          Sin ventas en el rango.
        </p>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/finance/components/revenue-kpi-cards.tsx src/modules/finance/components/revenue-trend-chart.tsx
git commit -m "feat(finance): add revenue KPI cards and daily trend chart"
```

---

### Task 10: UI — desglose por categoría

**Files:**
- Create: `src/modules/finance/components/revenue-by-category-chart.tsx`
- Create: `src/modules/finance/components/revenue-by-category-table.tsx`

**Interfaces:**
- Consumes: `CategoryRevenueDto` (Task 4, type-only); `createDataTableColumnHelper`, `DataTable` (`@/components/shared/data-table`); `formatPriceFromCents` (`@/lib/utils`).
- Produces: `RevenueByCategoryChart`, `RevenueByCategoryTable` (componentes React).

- [ ] **Step 1: Gráfico por categoría**

Crea `src/modules/finance/components/revenue-by-category-chart.tsx`:

```tsx
"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPriceFromCents } from "@/lib/utils";
import type { CategoryRevenueDto } from "@/modules/finance/types/revenue";

type RevenueByCategoryChartProps = { data: CategoryRevenueDto[] };

/** `--primary` (013 D10): `--brand` ya lo usa la tendencia diaria. */
const chartConfig = {
  revenueCents: { label: "Ingresos", color: "var(--primary)" },
} satisfies ChartConfig;

const MAX_LABEL_LENGTH = 22;

function truncate(label: string): string {
  return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;
}

export function RevenueByCategoryChart({ data }: RevenueByCategoryChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos por categoría</CardTitle>
        <CardDescription>Rango elegido</CardDescription>
      </CardHeader>

      {data.length > 0 ? (
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full px-2">
          <BarChart accessibilityLayer data={data} layout="vertical" margin={{ right: 16 }}>
            <XAxis type="number" dataKey="revenueCents" hide />
            <YAxis
              type="category"
              dataKey="categoryName"
              tickLine={false}
              axisLine={false}
              width={150}
              tickMargin={4}
              tickFormatter={(value) => truncate(String(value))}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => formatPriceFromCents(Number(value))} />}
            />
            <Bar dataKey="revenueCents" fill="var(--primary)" radius={4} barSize={18} />
          </BarChart>
        </ChartContainer>
      ) : (
        <p className="text-muted-foreground flex h-64 items-center justify-center text-sm">
          Sin ventas en el rango.
        </p>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Tabla por categoría**

Crea `src/modules/finance/components/revenue-by-category-table.tsx`. La columna Margen muestra "Sin datos suficientes" cuando `marginCents` es `null` — el hallazgo de Review Focus sobre cobertura cero por categoría (016 D4):

```tsx
"use client";

import { useMemo } from "react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { formatPriceFromCents } from "@/lib/utils";
import type { CategoryRevenueDto } from "@/modules/finance/types/revenue";

type RevenueByCategoryTableProps = {
  rows: CategoryRevenueDto[];
};

const helper = createDataTableColumnHelper<CategoryRevenueDto>();

export function RevenueByCategoryTable({ rows }: RevenueByCategoryTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("categoryName", {
          header: "Categoría",
          cell: (context) => <span className="text-sm font-medium">{context.getValue()}</span>,
        }),
        helper.accessor("revenueCents", {
          header: "Ingresos",
          cell: (context) => <span className="tabular-nums">{formatPriceFromCents(context.getValue())}</span>,
        }),
        helper.accessor("units", {
          header: "Unidades",
          cell: (context) => <span className="tabular-nums">{context.getValue()}</span>,
        }),
        helper.accessor("marginCents", {
          header: "Margen",
          cell: (context) => {
            const value = context.getValue();
            return (
              <span className="text-muted-foreground tabular-nums">
                {value === null ? "Sin datos suficientes" : formatPriceFromCents(value)}
              </span>
            );
          },
        }),
      ]),
    [],
  );

  return (
    <DataTable columns={columns} data={rows} emptyMessage="Sin ventas en el rango." />
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/finance/components/revenue-by-category-chart.tsx src/modules/finance/components/revenue-by-category-table.tsx
git commit -m "feat(finance): add revenue by-category chart and table"
```

---

### Task 11: UI — manager, página y navegación

**Files:**
- Create: `src/modules/finance/components/revenue-manager.tsx`
- Create: `src/app/(admin)/admin/finance/revenue/page.tsx`
- Modify: `src/components/shared/admin-shell.tsx`

**Interfaces:**
- Consumes: `RevenueRangePicker` (Task 8), `RevenueKpiCards`/`RevenueTrendChart` (Task 9), `RevenueByCategoryChart`/`RevenueByCategoryTable` (Task 10), `useRevenue`/`useRevenueFilters` (Task 7); `can`, `PERMISSIONS` (`@/lib/permissions`).
- Produces: `RevenueManager` (componente React); página `/admin/finance/revenue`; entrada "Ingresos" en el nav.

- [ ] **Step 1: Manager**

Crea `src/modules/finance/components/revenue-manager.tsx` (calco de `dashboard-manager.tsx`):

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RevenueByCategoryChart } from "@/modules/finance/components/revenue-by-category-chart";
import { RevenueByCategoryTable } from "@/modules/finance/components/revenue-by-category-table";
import { RevenueKpiCards } from "@/modules/finance/components/revenue-kpi-cards";
import { RevenueRangePicker } from "@/modules/finance/components/revenue-range-picker";
import { RevenueTrendChart } from "@/modules/finance/components/revenue-trend-chart";
import { useRevenue, useRevenueFilters } from "@/modules/finance/hooks/use-revenue";

function RevenueSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

export function RevenueManager() {
  const { filters, query, setPreset, setCustomRange } = useRevenueFilters();
  const { data, isLoading, error, refetch } = useRevenue(query);

  return (
    <div className="flex flex-col gap-6">
      <RevenueRangePicker filters={filters} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />

      {query === null ? (
        <p className="text-muted-foreground text-sm">Elige un rango de fechas para ver el reporte.</p>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-destructive text-sm">No se pudo cargar el reporte: {error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <RevenueSkeleton /> : null}

      {data ? (
        <>
          <RevenueKpiCards
            revenueCents={data.revenueCents}
            ordersCount={data.ordersCount}
            marginCents={data.marginCents}
            marginCoveragePercent={data.marginCoveragePercent}
          />

          <RevenueTrendChart data={data.dailyRevenue} />

          <RevenueByCategoryChart data={data.byCategory} />
          <RevenueByCategoryTable rows={data.byCategory} />
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Página**

Crea `src/app/(admin)/admin/finance/revenue/page.tsx`:

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { can, PERMISSIONS } from "@/lib/permissions";
import { RevenueManager } from "@/modules/finance/components/revenue-manager";

export const metadata: Metadata = {
  title: "Ingresos",
};

export default async function AdminRevenuePage() {
  const canRead = await can(PERMISSIONS.FINANCE_READ);
  if (!canRead) redirect("/admin");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresos</h1>
        <p className="text-muted-foreground text-sm">
          Ingresos y margen bruto real por rango de fechas, con desglose por categoría.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <RevenueManager />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 3: Entrada de navegación**

En `src/components/shared/admin-shell.tsx`, agrega "Ingresos" después de "Finanzas" en `NAV_ITEMS` (sin gating, mismo criterio D15 ya usado por el resto de la lista):

```ts
const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/categories", label: "Categorías" },
  { href: "/admin/products", label: "Productos" },
  { href: "/admin/inventory", label: "Inventario" },
  { href: "/admin/finance/unit-price", label: "Finanzas" },
  { href: "/admin/finance/revenue", label: "Ingresos" },
  { href: "/admin/orders", label: "Pedidos" },
  { href: "/admin/roles", label: "Roles y accesos" },
  { href: "/admin/audit-logs", label: "Bitácora" },
];
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 5: Verificación manual en el navegador (sin navegador disponible en esta sesión — ver Review Focus)**

Run: `npm run dev`. Con una sesión `super_admin`/`admin`: entrar a `/admin/finance/revenue`, confirmar que carga "Este mes" por defecto, cambiar de preset, elegir un rango libre en el calendario, y confirmar que el margen muestra "Sin dato"/"X% de cobertura" de forma coherente con lo que haya en `/admin/finance/unit-price`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/components/revenue-manager.tsx "src/app/(admin)/admin/finance/revenue/" src/components/shared/admin-shell.tsx
git commit -m "feat(finance): add revenue manager, page and nav entry"
```

---

### Task 12: Verificación final y cierre del spec

**Files:**
- Modify: `docs/specs/016-finance-revenue.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: spec 016 con `status: done` y criterios de aceptación marcados (los que se pudieron observar).

- [ ] **Step 1: Correr toda la verificación**

Run: `npm run typecheck && npm run lint && npm run build && npm test`
Expected: las cuatro en verde. `npm test` debe mostrar los tests nuevos de `utils.test.ts` (funciones agregadas), `revenue.schema.test.ts` y `revenue.test.ts` (DTO) pasando.

- [ ] **Step 2: Repasar los criterios de aceptación contra lo implementado**

- AC1–AC3: cubiertos por `resolveMarginCoverage`/`toCategoryRevenueDto` (Tasks 2 y 4).
- AC4: cubierto por `revenueQuerySchema` (Task 3).
- AC5: parcialmente — el 401 sin sesión se verificó (Task 6); el 403 con sesión autenticada sin `finance.read` y el redirect de página no, por falta de navegador en esta sesión.
- AC6: cubierto por `fillMissingDaysInRange` (Task 2).
- AC7: cubierto por `toCategoryRevenueDto` (Task 4) y el renderizado de la tabla (Task 10).
- AC8: cubierto por `resolveDateRangePreset` (Task 2, tests de `last_month`).

- [ ] **Step 3: Marcar el spec**

En `docs/specs/016-finance-revenue.md`:
1. Cambia `status: draft` a `status: done`.
2. Marca `[x]` en AC1, AC2, AC3, AC4, AC6, AC7, AC8. Deja AC5 sin marcar y anota: "Parcial — el 401 sin sesión está verificado; el 403 autenticado sin `finance.read` y el redirect de `/admin/finance/revenue` requieren una sesión real de navegador, no disponible en esta sesión de ejecución."
3. Agrega `## Notas de implementación` breve: qué se reutilizó de 013 sin tocar (`getSalesSummary`, `getDailySales`), y que no hizo falta permiso nuevo.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/016-finance-revenue.md
git commit -m "docs(finance): close spec 016 — revenue phase 2"
```

---

## Self-Review

**1. Cobertura del spec:** Objetivo → Tasks 9–11 (KPIs, tendencia, categoría, página). Alcance (incluye) → página/endpoint (Tasks 6, 11), presets+calendario (Task 8), sin permiso nuevo (Global Constraints, ningún task lo agrega). D1 (sin permiso) → confirmado por omisión. D2 (cobertura) → Task 2 (`resolveMarginCoverage`) y Task 4. D3 (resolución de preset en cliente) → Task 2 (`resolveDateRangePreset`) y Task 7. D4 (sin cobertura por fila) → Task 10 (`marginCents` único campo, sin columna extra). D5 (tendencia diaria) → Task 9. D6 (URL en inglés) → Task 11 (`/admin/finance/revenue`). D7 (KPI de `getSalesSummary`, categoría de `order_items`) → Task 5. Alcance (no incluye) → ningún task agrega comparación de período, exportación, ni desglose por producto individual: confirmado por omisión.

**2. Placeholders:** ninguno — cada step tiene código completo o un comando con su output esperado.

**3. Consistencia de tipos:** `CategoryRevenueRow` (Task 1) se usa igual en Task 4 (`toCategoryRevenueDto`). `CategoryRevenueDto`/`RevenueSummaryDto` (Task 4) se usan igual en Tasks 5, 6, 7, 9, 10, 11. `RevenueQuery`/`RevenueFilters`/`RevenueFilterPreset` (Task 3) se usan igual en Tasks 6, 7, 8, 11. `resolveDateRangePreset`/`REVENUE_RANGE_PRESETS`/`fillMissingDaysInRange`/`resolveMarginCoverage`/`DailyRevenuePoint` (Task 2) se usan igual en Tasks 4, 5, 7, 8, 9. `getRevenueSummary` (Task 5) solo se llama desde Task 6.

**4. Review Focus:** los cinco puntos están pinneados cada uno a un task concreto (2, 3, 2, 4+10, 7); ninguno quedó sin dueño.
