---
id: 021
title: Finanzas — Fase 6, entrega 1: Contabilidad (libro diario, solo lectura)
status: in-review
module: finance
scope: admin
---

# 021 — Finanzas — Fase 6.1: Libro diario

## Objetivo
Cualquiera con `finance.read` elige un mes (UTC) y ve el libro diario de partida doble, calculado de ventas cobradas y egresos, con cada asiento cuadrado y explicado en lenguaje llano.

## Alcance
Incluye: plan de cuentas fijo en código, asientos automáticos calculados al vuelo (venta cobrada, egreso), libro diario paginado con totales del mes, explicación para no expertos, pestaña **Contabilidad** activa.
No incluye (roadmap): 6.2 asientos manuales (requiere tabla) · 6.3 libro mayor y balance de comprobación · 6.4 balance general y cierre de mes (faltan bancos, inventario valorizado, compras de mercadería) · otros: CSV, gráfico, comparación de periodos, rango libre, IGV de compras, permiso nuevo, cambios de BD.

## Decisiones
| # | Decisión |
|---|---|
| D1 | **Sin tablas ni migración**: asientos armados en cada GET desde `orders`/`order_items` (`SETTLED_STATUSES`) y `expenses`. Contra: editar/borrar un egreso viejo cambia su asiento sin historial; 6.2 necesitará tabla. |
| D2 | Plan de cuentas **reducido y con códigos propios** (inspirados en el PCGE, no es el PCGE): `10` Caja y bancos, `20` Mercaderías, `40` IGV por pagar, `69` Costo de ventas, `70` Ventas, y `63.01`–`63.08` una cuenta de gasto por categoría, en el orden de `EXPENSE_CATEGORY_VALUES`, nombre = `EXPENSE_CATEGORY_LABEL`. Tipado `Record<ExpenseCategoryValue, …>`: una categoría nueva rompe typecheck. |
| D3 | Asiento de venta (1 por pedido, fecha = `created_at` UTC): Debe Caja `total`; Haber Ventas `base`; Haber IGV `igv` (`splitGross`, IGV 18 %, sin IPM). Si costo conocido > 0, además Debe Costo de ventas / Haber Mercaderías por Σ `cost_cents_snapshot × qty` de líneas con costo. |
| D4 | Asiento de egreso (fecha = `incurred_on`): Debe gasto de su categoría / Haber Caja por `amount_cents`. Sin separar IGV de compras (018). Glosa = etiqueta + `description`. Glosa de venta = `Venta pedido #<8 primeros del id>`, sin datos del cliente. |
| D5 | Cuadre: `isBalanced(entry)` = Σ debe = Σ haber (enteros exactos). La renta estimada **no** es asiento (no es movimiento real). |
| D6 | **Volumen**: paginación en servidor, `JOURNAL_PAGE_SIZE = 50` asientos fijo (el cliente no lo elige). Una consulta `UNION ALL` pagina orígenes (pedidos + egresos) por fecha, luego `id`; el costo por pedido se trae solo para los ids de la página (un `inArray` agrupado, sin N+1). Totales del mes con agregados aparte, reutilizando consultas de 018. Sumas nuevas en `::float8`. |
| D7 | Orden: clave = `created_at` (pedido) o `incurred_on` a las 00:00 UTC (egreso), desempate por `id`; los egresos de un día van antes que las ventas de ese día. |
| D8 | Mes: `profitQuerySchema` (regex y ≤ mes UTC actual) + `page` entero ≥ 1 (default 1); página fuera de rango → `entries: []`, 200. Rango con `monthToUtcRange`; selector y `?month=` con `useProfitMonth` + `ProfitMonthPicker` de 020 (2.º consumidor: se reutilizan, no se mueven). Cambiar de mes vuelve a página 1. |
| D9 | `ensureRecurringExpenses()` antes de leer egresos (D12 de 017 / D9 de 018). |
| D10 | Totales del mes: `grossCents` (`getMonthlySales`), `costKnownCents = Σ revenueCentsKnown − Σ marginCentsKnown` (`getRevenueByCategory`, criterio 018 D5), `expensesCents` (`sumAmountBetween`). `debitCents = gross + costKnown + expenses`; `creditCents = base + igv + costKnown + expenses` con `splitGross(gross)`. Cobertura con `resolveMarginCoverage` como 018/020. |
| D11 | Mercaderías queda **negativa** (−costo conocido) porque no se registran compras: se muestra rotulada con su explicación. |
| D12 | Página sin guard ni `<main>` (los da el layout de 019), sin lecturas en servidor. Slug verificado en `sections.ts`: `accounting` → `/admin/finance/accounting`; no se toca `admin-shell.tsx`. |

## Criterios de aceptación
- [x] AC1 — Dado un pedido de 11 800 con costo conocido 6 000, su asiento tiene Debe Caja 11 800, Haber Ventas 10 000, Haber IGV 1 800, Debe Costo de ventas 6 000, Haber Mercaderías 6 000, y cuadra.
- [x] AC2 — Dado un pedido con costo conocido 0 (o todas las líneas sin costo), el asiento solo tiene las 3 líneas de cobro.
- [x] AC3 — Dado cualquier total entero, el asiento de venta cuadra exacto (casos con redondeo, p. ej. 1, 99, 100 001).
- [x] AC4 — Dado un egreso `rent` de 50 000, el asiento es Debe `63.03` Alquiler / Haber `10` Caja por 50 000.
- [x] AC5 — Cada `EXPENSE_CATEGORY_VALUES` tiene exactamente una cuenta de gasto con código único.
- [x] AC6 — `month` ausente/mal formado/futuro, `page` 0, negativo o no entero → GET 400 (nunca 500).
- [ ] AC7 — Dado un mes con > 50 asientos, cada página trae ≤ 50, `totalEntries` es el total del mes y los totales no cambian entre páginas.
- [ ] AC8 — Los asientos salen ordenados por fecha y luego id (D7), sin repetirse entre páginas.
- [ ] AC9 — `debitCents = creditCents` del mes; si algún asiento o el total no cuadra, la UI muestra aviso `role="alert"`.
- [ ] AC10 — El Debe/Haber de Ventas + IGV del mes coincide con `baseCents`/`igvCents` de `GET /api/admin/finance/taxes` para el mismo rango.
- [ ] AC11 — Dado un GET, las plantillas recurrentes vencidas se materializan antes de leer egresos.
- [ ] AC12 — Con ventas y cobertura < 100 %, aviso `role="alert"` con el % de cobertura.
- [ ] AC13 — Se ve Mercaderías negativa rotulada (aviso en el resumen del mes). _2026-09-24: el humano retiró la tarjeta «Cómo leer el libro diario», así que ya no hay textos de qué es un asiento ni de debe/haber._
- [ ] AC14 — Carga → skeleton; error → mensaje + "Reintentar"; mes sin ventas ni egresos → estado vacío.
- [ ] AC15 — Sin `finance.read`: API 403 y `/admin/finance/accounting` redirige a `/admin`.
- [ ] AC16 — "Contabilidad" es pestaña activa hacia `/admin/finance/accounting`; el diff no toca `admin-shell.tsx`.

## Datos
Sin cambios de esquema.

## API
| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/accounting` | `requirePermission(PERMISSIONS.FINANCE_READ)` | `month`, `page` | `AccountingJournalDto` |

Zod: `accountingQuerySchema = profitQuerySchema.extend({ page })` (D8); tipo `AccountingQuery`.
`JournalLine`: `{ accountCode, accountName, debitCents, creditCents }`.
`JournalEntry`: `{ id: 'order:<uuid>'|'expense:<uuid>', kind: 'sale'|'expense', date: 'YYYY-MM-DD', description, lines, debitCents, creditCents, balanced }`.
`AccountingJournalDto`: `{ month, page, pageSize, totalEntries, entries, totals: { grossCents, costKnownCents, expensesCents, debitCents, creditCents, merchandiseBalanceCents }, costCoveragePercent, balanced }` (`balanced` = total del mes y todos los asientos de la página).

## Reutilizar
- `src/modules/finance/taxes.ts` — `splitGross`.
- `src/modules/finance/utils.ts` — `resolveMarginCoverage`.
- `src/modules/finance/profit.ts` — `monthToUtcRange`; `schemas/profit.schema.ts` — `profitQuerySchema`.
- `src/modules/finance/hooks/use-profit.ts` — `useProfitMonth`; `components/profit-month-picker.tsx` — `ProfitMonthPicker`.
- `src/modules/finance/constants.ts` — `EXPENSE_CATEGORY_LABEL`; `schemas/expense.schema.ts` — `EXPENSE_CATEGORY_VALUES`, `ExpenseCategoryValue`.
- `src/modules/finance/recurring.ts` — `toUtcDateString`; `src/server/services/recurring-expense.service.ts` — `ensureRecurringExpenses`.
- `src/server/repositories/order.repository.ts` — `getMonthlySales`, `getRevenueByCategory`; `expense.repository.ts` — `sumAmountBetween`.
- `src/modules/orders/constants.ts` — `SETTLED_STATUSES`.
- `src/app/api/admin/finance/profit/route.ts`, `profit-manager.tsx`, `finance/profit/page.tsx` — patrones de handler, carga/error/vacío y página.
- `src/lib/axios.ts` (`api`), `src/lib/utils.ts` (`formatPriceFromCents`), shadcn ya instalados: `card`, `table`, `badge`, `button`, `skeleton`.

## Tareas
- [x] T1 — `CHART_OF_ACCOUNTS` (D2), `JOURNAL_PAGE_SIZE`, tipos `JournalLine`/`JournalEntry`, `buildSaleEntry`, `buildExpenseEntry`, `isBalanced` (imports relativos `.ts`) · `src/modules/finance/accounting.ts`
- [x] T2 — Tests de T1 (AC1–AC5) · `src/modules/finance/accounting.test.ts`
- [x] T3 — `accountingQuerySchema` (D8, `../schemas/profit.schema.ts` relativo) · `src/modules/finance/schemas/accounting.schema.ts`
- [x] T4 — Tests del schema (AC6) · `src/modules/finance/schemas/accounting.schema.test.ts`
- [x] T5 — `AccountingJournalDto` + `buildAccountingJournal` puro (orígenes de la página, costo por pedido, agregados → DTO, D10) · `src/modules/finance/types/accounting.ts`
- [x] T6 — Tests del DTO (totales, `balanced`, Mercaderías = −costo, AC9) · `src/modules/finance/types/accounting.test.ts`
- [x] T7 — `listJournalSources(from, to, page, pageSize)` → `{ data, total }` con `UNION ALL` pedidos cobrados + egresos, orden D7, `::float8` · `src/server/repositories/journal-source.repository.ts`
- [x] T8 — `sumKnownCostByOrderIds(ids)` agrupado por `order_id`, `filter (where cost not null)`, `::float8`, `[]` si no hay ids · `src/server/repositories/order.repository.ts`
- [x] T9 — `getAccountingJournal(query)`: rango → `ensureRecurringExpenses` → `Promise.all` (T7, `getMonthlySales`, `getRevenueByCategory`, `sumAmountBetween`) → T8 → T5 · `src/server/services/accounting.service.ts`
- [x] T10 — GET handler: permiso → Zod → service · `src/app/api/admin/finance/accounting/route.ts`
- [x] T11 — `fetchAccountingJournal(query)` axios · `src/modules/finance/services/accounting.service.ts`
- [x] T12 — `accountingKeys`, `useAccountingJournal(month, page)` con `placeholderData: keepPreviousData` · `src/modules/finance/hooks/use-accounting.ts`
- [~] T13 — ~~`AccountingGuide`~~ retirada el 2026-09-24 a pedido del humano tras ver la pantalla; el componente `accounting-guide.tsx` se eliminó.
- [x] T14 — `JournalSummary`: Total Debe/Haber, aviso de descuadre (AC9), Mercaderías negativa rotulada, aviso de cobertura (AC12) · `src/modules/finance/components/journal-summary.tsx`
- [x] T15 — `JournalTable`: asientos agrupados (fecha, glosa, líneas código/cuenta/debe/haber, badge si no cuadra) + paginación anterior/siguiente "Página x de y" · `src/modules/finance/components/journal-table.tsx`
- [x] T16 — `AccountingManager` (cliente): picker + `page` en estado con `key={month}` (D8) + carga/error/vacío + T14–T15 · `src/modules/finance/components/accounting-manager.tsx`
- [x] T17 — Página (D12), h1 "Contabilidad", descripción, `Suspense` · `src/app/(admin)/admin/finance/accounting/page.tsx`
- [x] T18 — `accounting` → `status: "available"` · `src/modules/finance/sections.ts`

Verificación final: `npm run typecheck && npm run lint && npm test` (el `build` lo corre el reviewer). Marcar `[x]` solo en AC observados (tests en verde o prueba manual real).

## Notas
- `orders` no tiene índice por `created_at` solo (`orders_user_id_created_at_idx` empieza por `user_id`): el filtro del mes escanea la tabla. Aceptable hoy; si crece, índice en entrega aparte (hoy sin migración).
- `getRevenueByCategory` suma en `::int` por categoría (016); si un mes lo desborda, pasarlo a `float8` afecta también a 016/018.
- Los totales del mes vienen de agregados (D10), no de sumar páginas; el cuadre por asiento lo garantizan y prueban T1/T2.
- `splitGross(gross del mes)` y la suma de los `splitGross` por pedido pueden diferir en céntimos por redondeo; D10 usa el del mes para coincidir con 018 (AC10). Se muestra así y se rotula.
