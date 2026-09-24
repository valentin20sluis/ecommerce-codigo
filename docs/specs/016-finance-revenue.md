---
id: 016
title: Finanzas — Fase 2: Ingresos (revenue + margen por categoría)
status: done
module: finance
scope: admin
---

# 016 — Finanzas — Fase 2: Ingresos

## Objetivo
Un operador con `finance.read` abre `/admin/finance/revenue` y ve, para un rango de fechas
elegido (preset de negocio o libre), los ingresos totales, el margen bruto real (usando el
costo congelado por venta de la Fase 1) con su cobertura, una tendencia diaria y un desglose
por categoría de producto — el primer reporte del panel que combina cuánto se vendió con
cuánto se ganó de verdad, algo que el dashboard operativo (013) no calcula.

## Contexto — roadmap del módulo de Finanzas
Fase 2 de 6 (ver `docs/specs/015-finance-unit-price-margin.md` §Contexto para la tabla
completa). Depende de la Fase 1 (015): usa `products.cost_cents` y, sobre todo,
`order_items.cost_cents_snapshot` para el margen.

## Alcance
Incluye:
- Página `/admin/finance/revenue`: selector de rango (presets + calendario libre), 2 KPI
  cards (Ingresos, Margen bruto + % de cobertura), línea de tendencia diaria, gráfico de
  barras por categoría, tabla por categoría.
- Un endpoint agregado `GET /api/admin/finance/revenue`.
- Reutiliza el permiso `finance.read` (015 D4 ya preveía "a futuro, el resto de reportes de
  Finanzas") — **sin permiso nuevo**.

No incluye:
- Comparación contra el período anterior, exportar a CSV/Excel, desglose por producto
  individual (ya existe "top productos" en el dashboard).
- Egresos, impuestos ni estado de resultados — fases 3, 4 y 5.
- Cobertura de margen por categoría en la tabla (solo se muestra el % global en el KPI, no
  por fila, para no saturar la tabla — D4).

## Decisiones
| # | Decisión |
|---|---|
| D1 | Sin permiso nuevo: `finance.read` cubre este reporte, ya concedido a `super_admin`/`admin`/`manager`/`audit` desde la Fase 1. |
| D2 | El margen se calcula **solo** sobre líneas de `order_items` con `cost_cents_snapshot` no nulo. Se expone `marginCoveragePercent` (qué % de los ingresos del rango viene de líneas con costo conocido) junto al KPI, para que el número no engañe cuando la cobertura es baja. Si la cobertura es 0%, `marginCents` viaja como `null` (mismo criterio D5 de la Fase 1: ausencia de dato ≠ margen 0). Los ingresos totales (`revenueCents`) sí cuentan el 100% de las ventas, tengan o no costo cargado. |
| D3 | El rango de fechas se resuelve en el **cliente** antes de pedir: los presets se traducen a `from`/`to` concretos en el hook, igual que `orderFiltersSchema` (`period: "month" \| "custom"`) ya hace para el historial de pedidos. El servidor solo valida `from`/`to`, nunca conoce el preset. Un preset "en curso" (**Este mes**, **Este trimestre**, **Este año**) va del inicio del período hasta **hoy** (no hasta el fin del período, que incluiría días futuros sin datos); un preset "cerrado" (**Mes pasado**) va del inicio al fin completo de ese período anterior. |
| D4 | La tabla por categoría no repite el % de cobertura por fila (ruido visual); una categoría sin ninguna línea con costo conocido muestra "Sin datos suficientes" en la columna Margen. La cobertura global vive una sola vez, en el KPI. |
| D5 | Tendencia diaria agregada aunque no se pidió explícitamente al inicio — **aprobada por el humano en el diseño**: un rango libre se entiende mejor con una curva que solo con dos números. Reutiliza sin cambios `orderRepository.getDailySales(from, to)` (013), que ya acepta cualquier rango, no solo 7/30/90. |
| D6 | URL en inglés (`/admin/finance/revenue`), como el resto del panel (`/admin/inventory`, `/admin/orders`); el nav y los títulos dicen "Ingresos" en español. |
| D7 | El desglose por categoría es una consulta nueva (`getRevenueByCategory`); los ingresos/pedidos totales del KPI reutilizan `orderRepository.getSalesSummary` (013) sin cambios — mismo criterio arquitectónico que el dashboard, que tampoco reconcilia el total de `orders` contra la suma de `order_items` de top productos. |

## Datos
Sin cambios de esquema ni migración. Solo lectura sobre `orders`, `order_items`, `products`,
`categories`. Una función de repositorio nueva:

`getRevenueByCategory(from: Date, to: Date)` en `src/server/repositories/order.repository.ts`,
junto a `getDailySales`/`getTopProducts`: join `order_items → orders (filtro `SETTLED_STATUSES`
+ rango) → products → categories`, agrupado por categoría. Por fila: `revenueCents` (`SUM(unit_price_cents * qty)`), `units` (`SUM(qty)`), `marginCentsKnown` y `revenueCentsKnown`
(mismas sumas pero solo en filas con `cost_cents_snapshot IS NOT NULL`, vía `SUM(... FILTER
(WHERE cost_cents_snapshot IS NOT NULL))`, mismo estilo que `getFacetCounts` en
`product.repository.ts`). El servicio deriva `marginCents`/`marginCoveragePercent` de esas dos
sumas, por categoría y en total.

## API
| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/revenue?from=&to=` | `finance.read` | `from`, `to` (ISO datetime, ambos requeridos, `to >= from`) | `RevenueSummaryDto` |

Zod en `src/modules/finance/schemas/revenue.schema.ts`: `revenueQuerySchema` (`from`/`to`
`z.iso.datetime()`, `superRefine` rechaza `to < from`). Sin default: el cliente siempre manda
un rango explícito (el hook por defecto abre en "Este mes").

`RevenueSummaryDto`:
```
{
  from: string; to: string;
  revenueCents: number; ordersCount: number;
  marginCents: number | null; marginCoveragePercent: number;
  dailyRevenue: { date: string; revenueCents: number }[];
  byCategory: { categoryId: string; categoryName: string; revenueCents: number; marginCents: number | null; units: number }[];
}
```

## UI
`src/app/(admin)/admin/finance/revenue/page.tsx`, calco del guard de página de
`unit-price/page.tsx` (`can(PERMISSIONS.FINANCE_READ)`, redirect a `/admin` si falta). Un
`RevenueManager` con: `RevenueRangePicker` (presets + `Calendar`/`Popover` de shadcn, ya
instalados, para el rango libre) · `RevenueKpiCards` (Ingresos, Margen + cobertura) ·
`RevenueTrendChart` (line, wrapper `chart.tsx` ya instalado, mismo `var(--brand)` que el
dashboard, 013 D10) · `RevenueByCategoryChart` (bar) · `RevenueByCategoryTable`
(`data-table.tsx`, sin paginación — el número de categorías es acotado).

Estados obligatorios: `Skeleton` en carga, error con reintento, vacío explícito por bloque
("Sin ventas en el rango"). Entrada de nav "Ingresos" en `admin-shell.tsx`, sin gating (mismo
criterio D15 de la Fase 1).

## Reutilizar
- `src/server/repositories/order.repository.ts` — `getSalesSummary`, `getDailySales`
  (sin cambios, ya aceptan rango libre); `SETTLED_STATUSES` de `orders/constants.ts`.
- `src/server/repositories/product.repository.ts` — patrón `FILTER (WHERE ...)` de
  `getFacetCounts` para las sumas condicionadas por cobertura.
- `src/modules/finance/utils.ts` — se le agregan `resolveMarginCoverage` y
  `fillMissingDaysInRange`, junto a `computeMargin` ya existente de la Fase 1.
- `src/modules/orders/schemas/order.schema.ts` — patrón `orderFiltersSchema` (preset↔fechas)
  para el filtro de rango en el cliente.
- `src/server/services/dashboard-metrics.service.ts` — patrón `fillMissingDays`/`resolveWindow`
  a generalizar para rango libre.
- `src/components/shared/data-table.tsx`, `src/components/ui/{calendar,popover,chart,card,skeleton}.tsx` — ninguno nuevo.
- `src/lib/permissions.ts` (`requirePermission`, `PERMISSIONS.FINANCE_READ`), `src/lib/api-error.ts`, `src/lib/axios.ts`, `src/lib/utils.ts` (`formatPriceFromCents`).
- `src/modules/finance/` — módulo ya creado en la Fase 1: se le agregan `schemas/revenue.schema.ts`, `types/revenue.ts`, `services/revenue.service.ts`, `hooks/use-revenue.ts`, `components/revenue-*.tsx`.

## Criterios de aceptación
- [x] AC1 — Dado un rango con ventas y todas con costo cargado, entonces `marginCoveragePercent = 100` y `marginCents` es la suma exacta de margen de esas líneas.
- [x] AC2 — Dado un rango sin ninguna línea con `cost_cents_snapshot`, entonces `marginCents` viaja `null` y `marginCoveragePercent = 0`; `revenueCents` sigue sumando el 100% de las ventas.
- [x] AC3 — Dado un rango mixto (algunas líneas con costo, otras sin), entonces `marginCoveragePercent` refleja la proporción real de ingresos con costo conocido, no la proporción de líneas.
- [x] AC4 — Dado `to < from`, entonces la API responde 400.
- [ ] AC5 — Dado un usuario sin `finance.read`, entonces `GET /api/admin/finance/revenue` responde 403 y `/admin/finance/revenue` redirige a `/admin`. **Parcial**: el 401 sin sesión está verificado (`curl` sin cookie); el 403 autenticado sin `finance.read` y el redirect de página requieren una sesión real de navegador, no disponible en esta sesión de ejecución.
- [x] AC6 — Dado un rango de 45 días sin ventas en 10 de ellos, entonces `dailyRevenue` trae los 45 puntos, con `revenueCents: 0` en los días sin ventas.
- [x] AC7 — Dada una categoría sin ninguna línea con costo conocido en el rango, entonces su fila en `byCategory` trae `marginCents: null` y la tabla muestra "Sin datos suficientes".
- [x] AC8 — Dado el preset "Mes pasado" un 15 de marzo, entonces el rango resuelto es 1–28/29/30/31 de febrero completo (mes calendario anterior, no "últimos 30 días").

## Notas de implementación (016, cierre)

- `getSalesSummary` y `getDailySales` (013) se reutilizaron **sin ningún cambio**: ya
  aceptaban cualquier rango `from`/`to`, no solo los 7/30/90 días fijos del dashboard. Solo
  `getRevenueByCategory` es una consulta nueva.
- Sin permiso nuevo: `finance.read` (015) ya cubría este reporte, tal como preveía su
  descripción original ("y, a futuro, el resto de reportes de Finanzas").
- Dos archivos (`types/revenue.ts` y `types/finance.ts` de la Fase 1) necesitan importar
  funciones puras de `modules/finance/utils.ts` para construir su DTO, pero `node --test` no
  resuelve imports de **valor** vía alias `@/` entre archivos — solo `import type`. En
  `types/revenue.ts` se usó un import relativo (`../utils.ts`), mismo precedente ya existente
  en `src/server/services/user-projection.ts`. `types/finance.ts` (Fase 1) tiene el mismo
  patrón de import por alias sin haberse roto porque ningún test lo carga todavía de forma
  directa — es un riesgo latente para cuando alguna fase futura le agregue un test.
- Verificación pendiente del usuario, sin navegador disponible en esta sesión: abrir
  `/admin/finance/revenue` con una sesión `super_admin`/`admin` y confirmar presets, rango
  libre y coherencia del margen con lo que muestre `/admin/finance/unit-price`.

Verificación final: `npm run typecheck && npm run lint && npm run build && npm test` — 194/194.

## Notas
- `getRevenueByCategory` no pagina: el número de categorías del catálogo es chico y acotado por el propio negocio, a diferencia de listados de productos o pedidos.
- Si en el futuro el checkout deja de ser "total = subtotal" (impuestos/envío, fase 4), D7 debe revisarse: `getSalesSummary` seguiría siendo la verdad de ingresos, pero `byCategory` (basado en `order_items`) podría no sumar exactamente igual — hoy sí coinciden.
