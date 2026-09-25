---
id: 020
title: Finanzas — Fase 5: Ganancias (estado de resultados mensual)
status: done
module: finance
scope: admin
---

# 020 — Finanzas — Fase 5: Ganancias

## Objetivo
Cualquiera con `finance.read` elige un mes (UTC) y ve el estado de resultados en cascada, con cada
línea explicada en lenguaje llano: Ventas sin IGV − Costo de lo vendido = Utilidad bruta − Egresos
= Utilidad operativa − Renta estimada = Utilidad neta.

## Alcance
Incluye: endpoint GET por mes, tabla en cascada con explicación por línea, selector de mes, cobertura
de costo con aviso, pestaña **Ganancias** activa.
No incluye: rango libre, comparación con otro periodo, columnas por mes, detalle por categoría,
gráfico, CSV, permiso nuevo, cambios de BD, IPM.

## Decisiones
| # | Decisión |
|---|---|
| D1 | **Sin lógica nueva de impuestos/utilidad**: `getProfitStatement` compone `getTaxSummary(from, to)` de `tax.service.ts`, que ya hace `ensureRecurringExpenses` (D12 de 017), tasa de `finance_settings`, `splitGross` (IGV 18 %), `resolveMarginCoverage` y `estimateIncomeTax`. No se extrae nada: es el 2.º consumidor y se reutiliza por composición, no por copia. |
| D2 | La cascada es una función pura `buildProfitStatement(month, summary)`: solo agrega `grossProfit = base − costo` y `net = operativa − renta`; `operativa = summary.profitCents`. |
| D3 | Slug real (verificado en `sections.ts`): `profit` → URL `/admin/finance/profit`. Etiquetas en español, URL en inglés (D12 de 018). |
| D4 | Mes `YYYY-MM` UTC → `from = Date.UTC(y, m−1, 1)`, `to = Date.UTC(y, m, 1) − 1` (último instante, lección de `last_month` en 016). |
| D5 | Zod del mes: regex `^20\d{2}-(0[1-9]\|1[0-2])$` y ≤ mes UTC actual; fuera de eso → 400. |
| D6 | Costo faltante como 018 D6/AC13: líneas sin `cost_cents_snapshot` = costo 0; aviso `role="alert"` si `grossCents > 0` y cobertura < 100 %. |
| D7 | Selector: `Select` con los últimos 24 meses UTC, por defecto el actual; estado en `?month=` (valor inválido en la URL → mes actual; también cae al mes actual un mes válido para la API pero fuera de esos 24, para que el `Select` nunca quede con un valor que no puede mostrar). |

## Criterios de aceptación
- [x] AC1 — Dado un `TaxSummaryDto`, `buildProfitStatement` cumple `grossProfit = salesBase − costOfSales`, `operatingProfit = grossProfit − expenses = summary.profitCents` y `netProfit = operatingProfit − incomeTax`.
- [x] AC2 — Dada una utilidad operativa ≤ 0, `incomeTaxCents = 0` y `netProfitCents = operatingProfitCents`.
- [x] AC3 — `monthToUtcRange("2024-02")` → `2024-02-01T00:00:00.000Z` a `2024-02-29T23:59:59.999Z`; `"2025-12"` cierra en `2025-12-31T23:59:59.999Z`.
- [ ] AC4 — `month` ausente, `2026-13`, `2026-1`, `1999-05` o posterior al mes UTC actual → GET 400 (nunca 500).
- [ ] AC5 — Dado un mes válido, `operatingProfitCents` e `incomeTaxCents` coinciden con `profitCents`/`incomeTaxCents` de `GET /api/admin/finance/taxes` para el mismo rango.
- [ ] AC6 — Dado un GET, las plantillas recurrentes vencidas se materializan antes de sumar egresos.
- [ ] AC7 — Cobertura < 100 % con ventas → aviso `role="alert"` de utilidad sobreestimada.
- [ ] AC8 — Mes sin ventas ni egresos → estado vacío; con egresos y sin ventas → cascada con pérdida.
- [ ] AC9 — Carga muestra skeleton; error muestra mensaje y "Reintentar".
- [ ] AC10 — Sin `finance.read`: API 403 y `/admin/finance/profit` redirige a `/admin`.
- [ ] AC11 — "Ganancias" es pestaña activa hacia `/admin/finance/profit`; el diff no toca `admin-shell.tsx`.
- [ ] AC12 — Cada línea muestra su explicación en lenguaje llano y la pantalla rotula «Estimación de gestión, no es una declaración tributaria»; se ve "IGV 18 %", nunca "IPM".
- [ ] AC13 — Cambiar el mes en el selector actualiza `?month=` y recarga la cascada.

## Datos
Sin cambios de esquema.

## API
| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/profit` | `requirePermission(PERMISSIONS.FINANCE_READ)` | `month` | `ProfitStatementDto` |

Zod: `profitQuerySchema` = `{ month }` (D5); tipo `ProfitQuery`.
`ProfitStatementDto`: `{ month, grossCents, salesBaseCents, costOfSalesCents, grossProfitCents,
expensesCents, operatingProfitCents, incomeTaxRateBps, incomeTaxCents, netProfitCents,
costCoveragePercent }`.

## Reutilizar
- `src/server/services/tax.service.ts` — `getTaxSummary(from, to)` (D1).
- `src/modules/finance/types/taxes.ts` — tipo `TaxSummaryDto` (entrada de `buildProfitStatement`).
- `src/lib/api-error.ts` (`toErrorResponse`), `src/lib/permissions` (`requirePermission`, `PERMISSIONS`) — patrón de `api/admin/finance/taxes/route.ts`.
- `src/lib/axios.ts` (`api`); `src/lib/utils.ts` (`formatPriceFromCents`).
- `src/modules/finance/hooks/use-revenue.ts` — patrón URL (`useSearchParams` + `router.replace`) a imitar.
- `src/modules/finance/components/taxes-manager.tsx` / `income-tax-section.tsx` — patrón de carga/error/aviso de cobertura.
- `src/app/(admin)/admin/finance/taxes/page.tsx` — patrón de página (h1, descripción, `Suspense`).
- shadcn ya instalados: `card`, `table`, `select`, `skeleton`, `button`.

## Tareas
- [x] T1 — `monthToUtcRange`, `currentUtcMonth(now)`, `recentUtcMonths(now, 24)` (imports relativos `.ts`) · `src/modules/finance/profit.ts`
- [x] T2 — Tests de T1 (AC3, límites de año) · `src/modules/finance/profit.test.ts`
- [x] T3 — `profitQuerySchema` (D5, usa `currentUtcMonth` vía `../profit.ts`) · `src/modules/finance/schemas/profit.schema.ts`
- [x] T4 — Tests del schema (AC4) · `src/modules/finance/schemas/profit.schema.test.ts`
- [x] T5 — `ProfitStatementDto` + `buildProfitStatement` (D2; `import type` de `./taxes.ts`) · `src/modules/finance/types/profit.ts`
- [x] T6 — Tests del DTO (AC1, AC2) · `src/modules/finance/types/profit.test.ts`
- [x] T7 — `getProfitStatement(month)`: rango (D4) → `getTaxSummary` → `buildProfitStatement` · `src/server/services/profit.service.ts`
- [x] T8 — GET handler: permiso → Zod → service · `src/app/api/admin/finance/profit/route.ts`
- [x] T9 — `fetchProfitStatement(query)` axios · `src/modules/finance/services/profit.service.ts`
- [x] T10 — `profitKeys`, `useProfitStatement(month)`, `useProfitMonth()` (D7) · `src/modules/finance/hooks/use-profit.ts`
- [x] T11 — `ProfitMonthPicker` (`Select`, etiqueta `Intl` es-PE con `timeZone: 'UTC'`) · `src/modules/finance/components/profit-month-picker.tsx`
- [x] T12 — `ProfitStatementTable`: 7 filas (−/= y utilidades resaltadas), explicación por línea, tasa de renta, cobertura con aviso (D6), rótulo · `src/modules/finance/components/profit-statement-table.tsx`
- [x] T13 — `ProfitManager` (cliente): picker + carga/error/vacío + tabla · `src/modules/finance/components/profit-manager.tsx`
- [x] T14 — Página sin guard ni `<main>` (los da el layout de 019), h1 "Ganancias", descripción, `Suspense` · `src/app/(admin)/admin/finance/profit/page.tsx`
- [x] T15 — Sección `profit` → `status: "available"` · `src/modules/finance/sections.ts`

Verificación final: `npm run typecheck && npm run lint && npm test` (el `build` lo corre el reviewer).
Marcar `[x]` solo en AC observados (tests en verde o prueba manual real).

## Notas
- La página no lee datos en servidor (nota de 019: layout y página corren en paralelo); solo `ProfitManager` vía API con `requirePermission`.
- La cobertura compara ingresos brutos con costo conocido vs. brutos totales (misma base que 018); el aviso es cualitativo.
- El brief pedía `profits/page.tsx`, pero `sections.ts` usa `profit`: se sigue `sections.ts` para no tocar el `href` (D3).

## Cierre (020)

Cerrado a pedido del humano el 2026-09-24, con typecheck, lint, build y 353 tests en verde y aprobado
por el reviewer. Los AC que siguen sin marcar (AC4–AC13) están implementados y trazados en código, pero
nadie los observó en ejecución (API real, BD o sesiones con y sin permiso); quedan así a propósito.
