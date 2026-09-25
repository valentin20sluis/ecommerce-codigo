---
id: 018
title: Finanzas — Fase 4: Impuestos (IGV de ventas + renta estimada)
status: done
module: finance
scope: admin
---

# 018 — Finanzas — Fase 4: Impuestos

> **Enmienda 2026-09-24** (corrección de decisión pedida por el humano: «que el IGV sea 18 % y
> borrar IPM»). Cambian D1, D2, D3, API/DTO, UI y AC1–AC2; se añaden T16–T20. Sin cambio de
> esquema ni migración: `0012` solo crea `finance_settings`, que no se toca. Aprobada por el
> humano y ejecutada (T16–T20).

## Objetivo
Cualquiera con `finance.read` ve, para un rango de fechas, cuánto IGV contienen las ventas
cobradas, mes a mes, y una **estimación** del impuesto a la renta del periodo. Un operador con
`finance.manage_taxes` puede cambiar la tasa de renta usada en la estimación. La pantalla explica
cada número y avisa que es una estimación de gestión, no una declaración tributaria.

## Contexto
Fase 4 de 6 (roadmap en `docs/specs/015-finance-unit-price-margin.md`). Depende de 015–017 y de
019 (Impuestos es sección de `/admin/finance`). El checkout **no cobra impuestos** (`total =
subtotal`, `checkout.service.ts`): los precios del catálogo ya son precios finales al consumidor.

## Alcance
Incluye:
- Descomposición del IGV de ventas: base imponible e IGV (18 %) por mes y del periodo.
- Renta estimada del periodo: `max(0, utilidad) × tasa`.
- Tabla `finance_settings` de una sola fila con la tasa de renta editable, con auditoría.
- Sección **Impuestos** de Finanzas (`/admin/finance/taxes`); permiso nuevo `finance.manage_taxes`.

No incluye:
- Cambios al checkout, a Stripe o al total que paga el cliente. IPM ni ningún otro tributo sobre ventas.
- IGV de compras / crédito fiscal; renta mensual, pagos a cuenta, retenciones, otros regímenes, multimoneda.
- Historial de tasas (se usa la **vigente hoy**). Gráfico (YAGNI).

## Decisiones
| # | Decisión |
|---|---|
| D1 | Los precios ya incluyen el **IGV 18 %** completo (decisión del humano, enmienda 2026-09-24). No existe IPM. Base = `gross ÷ 1.18`; el resto es IGV. El total del cliente no se toca. |
| D2 | Función pura `splitGross(grossCents)` en enteros: `base = round(gross × 100 ÷ 118)`, `igv = gross − base` → `base + igv = gross` exacto. Constante `IGV_RATE_BPS = 1800`; se eliminan `IPM_RATE_BPS` e `ipmCents`. |
| D3 | Redondeo **por mes**; totales del periodo = **suma de los meses** (`grossCents`, `baseCents`, `igvCents`), para que la tabla cuadre con los KPIs. Sin cambios de criterio en la enmienda. |
| D4 | Mes y rangos en UTC, como `getDailySales`. Solo `SETTLED_STATUSES` con `created_at` en rango. Suma con `::float8`. |
| D5 | Utilidad = `base total − costo conocido − egresos`; costo conocido = `revenueCentsKnown − marginCentsKnown` (016); egresos = suma de `expenses.amount_cents` con `incurred_on` entre los días UTC de `from`/`to`. |
| D6 | Líneas sin `cost_cents_snapshot` cuentan costo 0 (sobreestima utilidad): se muestra la cobertura (`resolveMarginCoverage`) y aviso si < 100 %. |
| D7 | Renta = `round(max(0, utilidad) × rateBps ÷ 10000)`; pérdida → 0. Rótulo: «Estimación de gestión, no es una declaración tributaria». |
| D8 | Tasa en `finance_settings.income_tax_rate_bps` (0–10000); sin fila → `DEFAULT_INCOME_TAX_RATE_BPS = 2950`. `PATCH` = upsert + auditoría `before`/`after` en la misma tx. |
| D9 | Toda lectura de egresos llama antes a `ensureRecurringExpenses` (D12 de 017). |
| D10 | `finance.read` para ver; `finance.manage_taxes` para cambiar la tasa (admin/super_admin vía `ALL_PERMISSIONS`; manager/audit solo `finance.read`). |
| D11 | Rango ≤ 1826 días y `to ≥ from` (`revenueQuerySchema`); tasa 0–10000 en Zod; archivos bajo `node --test` con imports relativos `.ts`; solo `[x]` en AC observados. |
| D12 | Sección de `/admin/finance` (019): `status: 'available'` en `FINANCE_SECTIONS`; no se toca `admin-shell.tsx`; el layout de 019 aplica el guard y el `<main>`. |

## Datos
`finance_settings` (`schema/finance-settings.ts`, migración `0012`, fila única): `id` int PK
`CHECK (id = 1)` · `income_tax_rate_bps` int NOT NULL `CHECK BETWEEN 0 AND 10000` · `updated_by`
uuid NULL → `users.id` `ON DELETE SET NULL` · `updated_at` timestamptz default now.
La enmienda **no cambia el esquema**. Sin cambios en `orders`, `order_items` ni `expenses`.

## API
| Método | Ruta | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/taxes` | `finance.read` | `from`, `to` (`revenueQuerySchema`) | `TaxSummaryDto` |
| PATCH | `/api/admin/finance/taxes/settings` | `finance.manage_taxes` | `{ incomeTaxRateBps }` (`updateTaxSettingsSchema`, `strictObject`, entero 0–10000) | `{ incomeTaxRateBps }` |

`TaxSummaryDto`: `{ from, to, grossCents, baseCents, igvCents, months: { month: 'YYYY-MM',
grossCents, baseCents, igvCents }[], costKnownCents, costCoveragePercent, expensesCents,
profitCents, incomeTaxRateBps, incomeTaxCents }` — **sin `ipmCents`** (enmienda). Meses sin ventas
con ceros. Auditoría: `finance_settings.updated` con `before`/`after` de `income_tax_rate_bps`.

## UI
`finance/taxes/page.tsx` (h1, descripción, `Suspense`, `can(FINANCE_MANAGE_TAXES)` como prop) → `TaxesManager`:
- `RevenueRangePicker` con los mismos presets.
- **IGV de ventas**: 3 KPIs (ventas cobradas, base imponible, IGV 18 %) y tabla mensual (Mes, Ventas
  cobradas, Base imponible, IGV 18 %) con fila de totales; texto: «Tus precios ya incluyen el IGV
  (18 %). La base imponible se obtiene dividiendo cada venta entre 1.18; el resto es IGV».
- **Renta estimada**: desglose, cobertura con aviso, rótulo D7, botón "Cambiar tasa" con `finance.manage_taxes`.
Estados de carga, error con reintento y vacío.

## Reutilizar
- `src/modules/finance/taxes.ts` (`splitGross`, `fillMissingMonthsInRange`, `sumTaxBreakdowns`,
  `estimateIncomeTax`) y `types/taxes.ts` (`buildTaxSummary`): se editan, no se recrean.
- `src/modules/finance/components/sales-tax-section.tsx`, `taxes-manager.tsx`: se editan.
- `revenueQuerySchema`, `RevenueRangePicker`, `resolveMarginCoverage`, `data-table.tsx`, shadcn ya instalados.

## Criterios de aceptación
- [x] AC1 — Dado un total bruto cualquiera, `splitGross` devuelve `base + igv = gross` exacto, sin campo `ipmCents`, y para 11 800 centavos `base = 10 000`, `igv = 1 800`.
- [x] AC2 — Dado un rango con ventas en varios meses, `months` trae una fila por mes (ceros donde no hubo ventas) y `grossCents`/`baseCents`/`igvCents` del DTO son la suma exacta de las filas.
- [ ] AC3 — Dado un rango sin ventas, todo es 0 (no error) y la UI muestra el estado vacío.
- [x] AC4 — `profitCents = baseCents − costKnownCents − expensesCents` e `incomeTaxCents = round(max(0, profit) × rateBps ÷ 10000)`. (La base no cambia con la enmienda; T19 lo re-ejecuta.)
- [x] AC5 — Dada una utilidad negativa, `incomeTaxCents = 0`.
- [ ] AC6 — Dado un GET, las plantillas recurrentes vencidas se materializan antes de sumar egresos.
- [ ] AC7 — Sin fila en `finance_settings`, la tasa es 2950 bps; tras un PATCH válido, la lectura devuelve la nueva.
- [ ] AC8 — `incomeTaxRateBps` fuera de 0–10000, no entero o campo extra → PATCH 400 (nunca 500).
- [ ] AC9 — PATCH válido → `finance_settings.updated` con `before`/`after` en `audit_logs` en la misma tx.
- [ ] AC10 — GET con `to < from` o rango > 1826 días → 400.
- [ ] AC11 — Con `finance.read` sin `finance.manage_taxes`: PATCH 403 y la UI no muestra "Cambiar tasa".
- [ ] AC12 — Sin `finance.read`: API 403 y `/admin/finance/taxes` redirige a `/admin` (layout de 019).
- [ ] AC13 — Cobertura de costo < 100 % → la UI muestra el aviso de utilidad sobreestimada.
- [ ] AC14 — "Impuestos" es pestaña activa hacia `/admin/finance/taxes` y el diff no toca `admin-shell.tsx`.
- [ ] AC15 — Dada la pantalla de Impuestos, no aparece "IPM" ni "16 %" en KPIs, columnas ni textos; se ve "IGV 18 %".

## Tareas
T1–T15 ejecutadas (implementación original): schema + migración `0012`, `taxes.ts` + tests, DTO +
tests, Zod, repositorios (`getMonthlySales`, `sumAmountBetween`, `finance-settings`), permiso,
`tax.service.ts`, Route Handlers, service axios + hooks, componentes, página y sección `available`.

Corrección (enmienda 2026-09-24):
- [x] T16 — `IGV_RATE_BPS = 1800`, borrar `IPM_RATE_BPS` e `ipmCents` de `TaxBreakdown`; `splitGross` con `igv = gross − base`; `sumTaxBreakdowns` sin `ipmCents`; comentarios sin IPM · `src/modules/finance/taxes.ts`
- [x] T17 — Tests: 11 800 → base 10 000 / igv 1 800; `base + igv = gross` en los casos existentes; quitar `ipmCents` de los `deepEqual` y sumas (AC1, AC2) · `src/modules/finance/taxes.test.ts`
- [x] T18 — Tests del DTO sin `ipmCents` (líneas 31 y 48); `types/taxes.ts` no cambia salvo que typecheck lo exija · `src/modules/finance/types/taxes.test.ts`
- [x] T19 — UI: quitar KPI y columna IPM, "IGV (16 %)"/"IGV 16 %" → "IGV (18 %)"/"IGV 18 %", grid de KPIs `lg:grid-cols-3`, texto explicativo de la sección UI · `src/modules/finance/components/sales-tax-section.tsx`
- [x] T20 — Quitar `ipmCents` del objeto `totals` pasado a `SalesTaxSection` · `src/modules/finance/components/taxes-manager.tsx`

Verificación final: `npm run typecheck && npm run lint && npm test` y `Grep -i "ipm" src/` sin resultados (el `build` lo corre el reviewer). Marcar AC1/AC2 solo tras ver los tests en verde.

## Notas
- Precios finales al consumidor: si el negocio pasa a cobrar el IGV encima del precio, hay que guardar el impuesto por pedido.
- `orders.total_cents` = suma de líneas (sin envío); con envío, la base debería calcularse sobre el total del pedido.
- La renta estimada ignora egresos no deducibles: orden de magnitud, no liquidación.
- La migración `0012` (y el seed con `finance.manage_taxes`) se aplicó a Neon el 2026-09-24; la enmienda no la regenera.

## Cierre (018)

Cerrado a pedido del humano el 2026-09-24, con typecheck, lint, build y 353 tests en verde y aprobado
por el reviewer. Los AC que siguen sin marcar (AC3, AC6–AC15) están implementados y trazados en código,
pero nadie los observó en ejecución (API real, BD o sesiones con y sin permiso); quedan así a propósito.
Migración `0012` y seed (`finance.manage_taxes`) aplicados a Neon el 2026-09-24.
