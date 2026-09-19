---
id: 013
title: Dashboard de métricas del admin
status: done
module: dashboard
scope: admin
---

# 013 — Dashboard de métricas del admin

## Objetivo
Un operador con `dashboard.read` abre `/admin` y ve ventas, pedidos, ventas por día,
top 5 productos y stock bajo en una sola carga, con rango de 7/30/90 días en la URL.

## Alcance
Incluye:
- KPI Ventas (suma `totalCents`) y KPI Pedidos (conteo) del rango.
- Line chart de ventas por día y bar chart top 5 productos por unidades, mismo rango.
- Lista de stock bajo (`stock <= 5`), independiente del rango, máx. 10 ítems.
- Selector de rango (3 botones) sincronizado con `?range=`.
- Un endpoint agregado `GET /api/admin/metrics`.

No incluye:
- Página `/admin/products` ni filtro de stock en `productsQuerySchema` (hueco previo del nav).
- Rango libre por calendario, comparación contra periodo anterior, export, websockets.
- Umbral de stock configurable por producto (futuro spec de Inventario).

## Decisiones
| # | Decisión |
|---|---|
| D1 | Venta/pedido = órdenes con `status` en `paid`, `processing`, `shipped`, `delivered`. Se promueve `SETTLED_STATUSES` (hoy local en `checkout/success/page.tsx:83`) a `src/modules/orders/constants.ts`; el server lo importa desde ahí. |
| D2 | `range` acepta solo `7 \| 30 \| 90` (default `7`). Ventana = `[date_trunc('day', now()) - (range-1) días, now()]`. |
| D3 | Agrupación diaria por `date_trunc('day', orders.created_at)` en UTC. Sin conversión de zona: una única definición de "día" para BD y UI. |
| D4 | El día sin ventas se rellena con `0` en el service, no en SQL: la serie siempre trae `range` puntos. |
| D5 | Un solo endpoint con los 5 bloques. Stock bajo viaja en la misma respuesta aunque ignore `range`: evita un segundo request para un solo listado. |
| D6 | Refetch cada 60 s vía `refetchInterval` de TanStack Query, sin `refetchIntervalInBackground`. |
| D7 | Stock bajo: solo productos con `isActive = true`, orden `stock` asc, límite 10. Un producto inactivo no se vende, no es alerta. |
| D8 | Cada ítem de stock bajo enlaza a `/admin/products?q=<name>` (param `q` ya existente). No se inventa `?stock=low`. |
| D9 | Charts con el wrapper oficial `npx shadcn@latest add chart` sobre Recharts (`^3.10.1`), por la regla dura de componentes shadcn. |
| D10 | Colores: line chart de ventas → `var(--brand)` (métrica protagonista); bar chart top productos → `var(--primary)`. **Prohibido** `--chart-1..--chart-5`: es rampa de gris puro (`--chart-1: oklch(0.87 0 0)`) y falla contraste sobre fondo blanco. |
| D11 | Top productos agrupa por `order_items.product_id` sumando `qty`, con `nameSnapshot` más reciente como etiqueta: el nombre mostrado es el del pedido, consistente con el resto del módulo. |
| D12 | Sin permiso nuevo: `PERMISSIONS.DASHBOARD_READ` ya existe y lo tienen 3 roles del catálogo (`src/modules/roles/constants.ts:60,74,93`). |

## Datos
Sin cambios de esquema. Sin migración. Solo agregaciones de lectura sobre
`orders`, `order_items` y `products`. Índices existentes cubren el filtro
(`orders_user_id_created_at_idx`, `order_items_order_id_idx`); si el plan degrada,
se anota como deuda, no se crea índice en este spec.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/metrics?range=7\|30\|90` | Clerk + `requirePermission('dashboard.read')` | — | `DashboardMetricsDto` |

Zod `metricsQuerySchema`: `range` (`z.coerce.number()` restringido a los 3 valores,
default 7). Respuesta `DashboardMetricsDto`:
`{ range, salesCents, ordersCount, dailySales: { date, salesCents }[], topProducts: { productId, name, units }[], lowStock: { id, name, slug, stock }[] }`.
`middleware.ts` ya cubre `/api/admin(.*)`: no se toca.

## UI
`/admin` en 3 filas: selector de rango + 2 KPI cards (`formatPriceFromCents` para ventas) ·
line chart ancho completo · bar chart horizontal + card de stock bajo.
Estados obligatorios: `Skeleton` mientras carga, mensaje de error con reintento,
y vacío explícito por bloque ("Sin ventas en el rango", "Todo con stock suficiente").

## Reutilizar
- `src/lib/permissions.ts` (`requirePermission`, `PERMISSIONS.DASHBOARD_READ`) — auth del handler.
- `src/lib/api-error.ts` (`toErrorResponse`) — catch del handler.
- `src/lib/utils.ts` (`formatPriceFromCents`) — KPI y tooltips.
- `src/lib/axios.ts` (`api`) — base del service cliente.
- `src/modules/orders/constants.ts` — destino de `SETTLED_STATUSES`.
- `src/server/repositories/order.repository.ts` — ya importa `and/gte/lte/inArray/sql`; las agregaciones se suman ahí.
- `src/server/repositories/product.repository.ts` — destino de `listLowStock`.
- `src/server/db/schema/{order,order-item,product}.ts` — columnas de las agregaciones.
- `src/modules/audit/hooks/use-audit-logs.ts` — plantilla del hook URL⇄query (`safeParse` + `router.replace`).
- `src/app/(admin)/admin/orders/page.tsx` — plantilla de página (`Suspense` + `Skeleton` + manager cliente).
- `src/app/api/admin/orders/route.ts` — plantilla de handler (permiso → Zod → repo → JSON).
- `src/components/ui/{card,skeleton,button}.tsx` — ya instalados.
- Falta instalar: `npx shadcn@latest add chart`.

## Tareas
- [x] T1 — Promover `SETTLED_STATUSES` (D1) · `src/modules/orders/constants.ts`
- [x] T2 — Importar la constante y borrar la local · `src/app/(storefront)/checkout/success/page.tsx`
- [x] T3 — `metricsQuerySchema` + `DASHBOARD_RANGES` (D2) · `src/modules/dashboard/schemas/metrics.schema.ts`
- [x] T4 — Tipos DTO de la respuesta · `src/modules/dashboard/types/metrics.ts`
- [x] T5 — `getSalesSummary(from, to)`: suma y conteo en un query · `src/server/repositories/order.repository.ts`
- [x] T6 — `getDailySales(from, to)` agrupado por día (D3) · `src/server/repositories/order.repository.ts`
- [x] T7 — `getTopProducts(from, to, limit)` por `qty` (D11) · `src/server/repositories/order.repository.ts`
- [x] T8 — `listLowStock(threshold, limit)` (D7) · `src/server/repositories/product.repository.ts`
- [x] T9 — `getDashboardMetrics(range)`: ventana, 4 lecturas, zero-fill (D4) · `src/server/services/dashboard-metrics.service.ts`
- [x] T10 — Handler `GET` con permiso + Zod · `src/app/api/admin/metrics/route.ts`
- [x] T11 — `fetchDashboardMetrics` con axios · `src/modules/dashboard/services/metrics.service.ts`
- [x] T12 — `useDashboardMetrics` (`refetchInterval` 60 s) + `useMetricsRange` (URL) · `src/modules/dashboard/hooks/use-dashboard-metrics.ts`
- [x] T13 — Instalar el chart de shadcn (D9) · `npx shadcn@latest add chart`
- [x] T14 — `DashboardRangeSelector` (3 botones) · `src/modules/dashboard/components/dashboard-range-selector.tsx`
- [x] T15 — `MetricKpiCards` (ventas + pedidos) · `src/modules/dashboard/components/metric-kpi-cards.tsx`
- [x] T16 — `SalesTrendChart` line, `var(--brand)` (D10) · `src/modules/dashboard/components/sales-trend-chart.tsx`
- [x] T17 — `TopProductsChart` bar, `var(--primary)` (D10) · `src/modules/dashboard/components/top-products-chart.tsx`
- [x] T18 — `LowStockCard` con enlaces (D8) · `src/modules/dashboard/components/low-stock-card.tsx`
- [x] T19 — `DashboardManager`: hook + layout + carga/error/vacío · `src/modules/dashboard/components/dashboard-manager.tsx`
- [x] T20 — Reemplazar el placeholder por el manager en `Suspense` · `src/app/(admin)/admin/page.tsx`

### Notas de implementación

- `src/modules/dashboard/constants.ts` (no previsto en la lista de tareas):
  `LOW_STOCK_THRESHOLD`, `LOW_STOCK_LIMIT` y `TOP_PRODUCTS_LIMIT`. El umbral lo
  necesitan el service (T9) y el rótulo de `LowStockCard` (T18); dejarlo en el
  service obligaría a que un componente importe de `src/server/`.
- `npx shadcn@latest add chart` generó `import { cn } from "cn"` y añadió un
  paquete `cn` a `package.json`, además de relajar `recharts` a `^3.8.0`. Se
  corrigió el import a `@/lib/utils` (como el resto de `components/ui/`), se
  eliminó la dependencia `cn` y se restauró `recharts@^3.10.1`: `package.json` y
  `package-lock.json` quedan sin cambios respecto a `master`.

Verificación final: `npm run typecheck && npm run lint`

## Criterios de aceptación
- [x] AC1 — Dado un operador con `dashboard.read` cuando abre `/admin` entonces ve los 5 bloques con datos del rango por defecto (7 días).
- [x] AC2 — Dado un usuario sin `dashboard.read` cuando pide `GET /api/admin/metrics` entonces recibe 403 de `toErrorResponse`.
- [x] AC3 — Dado `?range=30` en la URL cuando recarga entonces el selector marca 30 y los 3 bloques de rango recalculan; stock bajo no cambia.
- [x] AC4 — Dado un clic en otro rango entonces la URL se actualiza con `router.replace` sin scroll y sin recargar la página.
- [x] AC5 — Dada una orden en `pending_payment`, `payment_failed`, `canceled` o `expired` entonces no suma a ventas, pedidos, serie diaria ni top productos.
- [x] AC6 — Dado un día sin ventas dentro del rango entonces la serie lo incluye con `salesCents: 0` y el eje X muestra `range` puntos.
- [x] AC7 — Dado `range=7` con cero ventas entonces los KPI muestran `0` formateado y los charts muestran el vacío explícito, no un error.
- [x] AC8 — Dados 12 productos con `stock <= 5` entonces la lista muestra 10, ordenados por stock ascendente, y omite los inactivos.
- [x] AC9 — Dado `?range=45` o `?range=abc` entonces Zod lo rechaza con 400 y el hook cae al default 7 sin romper la vista.
- [x] AC10 — Dado que la pestaña está activa 60 s entonces se dispara un refetch y los datos se actualizan sin parpadeo de skeleton.
- [x] AC11 — Dado el line chart entonces su trazo usa `var(--brand)` y el bar chart `var(--primary)`; `grep -r "chart-[1-5]"` no aparece en `src/modules/dashboard/`.

## Notas
- `src/app/api/admin/metrics/` existe vacío en el working tree: T10 solo agrega `route.ts`.
- Riesgo N+1: T5–T8 son 4 queries agregadas fijas. Si se resuelve top productos leyendo cada producto por separado, es hallazgo bloqueante.
- `/admin/products` no tiene `page.tsx` todavía: los enlaces de D8 quedan apuntando al mismo destino roto que ya tiene el nav. No se arregla aquí.
