---
id: 009
title: Mis compras — historial de pedidos en /profile
status: done
module: orders
scope: client
created: 2026-09-09
---

# 009 — Mis compras — historial de pedidos en `/profile`

> Continúa 008 (líneas 28-31), que dejó el historial del cliente fuera de alcance.
> Usando `stripe:stripe-docs` para fijar de dónde sale la boleta: `charge.receipt_url`
> (nullable) expandiendo `latest_charge` del PaymentIntent. No hay campo de boleta en `orders`.

## Objetivo
Un cliente autenticado ve sus compras en `/profile/compras` agrupadas por día, las filtra
por mes actual o rango de fechas, y abre un Dialog con el detalle y la boleta de Stripe.

## Alcance
Incluye: `GET /api/orders` (solo las propias) · `GET /api/orders/[id]/receipt` ·
módulo `src/modules/orders/` completo · reemplazo del placeholder `/profile/compras`.

No incluye: página `(storefront)/orders/[id]` · cancelar/reordenar/reembolsar · admin de
pedidos y estados de fulfillment · descarga de PDF propio (se usa la boleta hosted de Stripe) ·
guardar `receipt_url` en BD · paginación infinita.

## Decisiones
| # | Decisión | Porqué |
|---|---|---|
| D1 | La boleta se pide **on-demand** al servidor (`paymentIntents.retrieve(id, { expand: ["latest_charge"] })` → `latest_charge.receipt_url`), sin columna nueva. | `orders.stripePaymentIntentId` ya está poblado por el webhook de 008. Guardar la URL exigiría migración + backfill de las órdenes ya pagadas, y `receipt_url` se mantiene al día ante reembolsos: cachearla la desactualiza. |
| D2 | El listado devuelve la orden **con sus líneas** en una respuesta; el Dialog no vuelve a la red. | Evita un endpoint `/api/orders/[id]` y un request por fila abierta. Las líneas se cargan con un solo `inArray(orderItems.orderId, ids)`, no N+1. |
| D3 | La agrupación por día/mes/año es **client-side**, sobre el `createdAt` en hora local del navegador. | Agrupar en SQL obliga a fijar una zona horaria en el servidor; el usuario espera ver "9 de septiembre" según su reloj. |
| D4 | Sin paginación: el rango de fechas es el limitador y el repo corta en `limit` (default 50, máx 100). | Con "mes actual" por defecto, un cliente real trae unidades de filas. Si llega al tope, la UI lo dice y pide acotar el rango. |
| D5 | Se excluyen las órdenes `canceled`. Se muestran `paid`, `pending_payment` y `payment_failed`. | `canceled` en 008 (D5) solo marca órdenes que Stripe rechazó al crear la sesión: ruido, nunca fueron una compra. |

## Datos
**Sin cambios de esquema. Sin migración.** Se leen `orders` y `order_items` tal como los define 008 (`src/server/db/schema/order.ts`, `order-item.ts`); los tipos se infieren de ahí. El índice `orders_user_id_created_at_idx` ya cubre el `WHERE user_id = ? AND created_at BETWEEN ...`.

## API
Envelope de error de `src/lib/api-error.ts`. Ambas rutas quedan protegidas por `middleware.ts`
sin tocarlo (`/api/orders` no está en `isPublicRoute`), más `requireAuth()` en el handler.

| Método | Ruta | Auth | Query/Body | Response |
|---|---|---|---|---|
| GET | `/api/orders` | `requireAuth()` | `ordersQuerySchema` (query) | `{ data: OrderListItemDto[], meta: { limit, truncated } }` 200 |
| GET | `/api/orders/[id]/receipt` | `requireAuth()` | `id` = `z.uuid()` (param) | `{ url: string }` 200 |

Errores: 401 sin sesión · 400 `VALIDATION_ERROR` · 404 `NOT_FOUND` si la orden no existe **o no es del usuario** (mismo código, para no filtrar existencia) · 409 `CONFLICT` si no está `paid`, no tiene `stripePaymentIntentId` o `receipt_url` viene null.

Zod en `src/modules/orders/schemas/order.schema.ts`:
- `ordersQuerySchema` = `{ from?: z.iso.datetime(), to?: z.iso.datetime(), limit: coerce.number().int().min(1).max(100).default(50) }`. **`userId` no existe en el schema**: sale de `requireAuth()`.
- `orderFiltersSchema` (solo URL del cliente) = `{ period: z.enum(["month","custom"]).default("month"), from?, to? }`.

## UI
`/profile/compras` (Server Component con `metadata`) compone `<OrderHistory />` (cliente):
- **Filtro** (estado en la URL): chips `Mes actual` / `Rango`. Con `Rango`, `Popover` + `Calendar mode="range" numberOfMonths={2}`, copiando `audit-log-filters.tsx:116-141`. Con `Mes actual`, el hook calcula `from` = día 1 a las 00:00 local y `to` = ahora.
- **Grupos**: encabezado por día — `9 de septiembre de 2026` (`toLocaleDateString("es", { day, month: "long", year })`) — desc, y dentro las órdenes desc por hora.
- **Fila**: `Card` con `#id.slice(0,8)`, hora, nº de artículos, total con `formatPriceFromCents` y `Badge` de estado (textos/variantes de `checkout/success/page.tsx:27-54`).
- **Dialog** (`components/ui/dialog`): líneas con `nameSnapshot`, `qty × unitPriceCents`, subtotal por línea, `Separator`, total + `currency.toUpperCase()`, y botón **Descargar boleta** que abre `receipt_url` en pestaña nueva (`target="_blank" rel="noopener noreferrer"`), solo con `status === "paid"`, con spinner y el mensaje del 409 si falla.
- Estados de carga (`Skeleton`), error y vacío obligatorios; el vacío reusa el copy del placeholder actual.

## Reutilizar
Verificado en el repositorio; se usa **tal cual**:
- `src/lib/auth.ts:20` `requireAuth` · `api-error.ts` `NotFoundError`/`ConflictError`/`toErrorResponse` · `src/lib/stripe.ts:17` `getStripe()`, **única** vía al SDK.
- `src/server/repositories/order.repository.ts` — `findByIdWithItems` (para el receipt) y el helper `loadItems`; se le añade `listByUser` (T1).
- `src/app/api/admin/audit-logs/route.ts` — plantilla literal del handler GET con query Zod.
- `src/server/repositories/audit-log.repository.ts:43-53` — patrón `SQL[]` + `gte`/`lte`/`and` para el rango.
- `src/modules/audit/hooks/use-audit-logs.ts` — patrón `useQuery` + filtros en URL (`useOrderFilters` es su calco).
- `src/modules/audit/services/audit-log.service.ts` — patrón de service axios sobre `api`.
- `src/modules/checkout/types/index.ts:8-17` — `Serialized<T>` + mapper de fechas a ISO, a copiar.
- `src/app/(storefront)/checkout/success/page.tsx:27-54` — `STATUS_VIEW` (título/badge/variant por estado).
- `src/modules/products/components/product-form-dialog.tsx` — uso correcto de `Dialog` en este proyecto.
- `src/lib/utils.ts:17` `formatPriceFromCents` · `src/lib/axios.ts` (`api`) · `src/types/api.ts` (`Serialized`).
- `profile/layout.tsx` + `customers/components/profile-nav.tsx:11` — ya enlazan la sección; **no se tocan**.
- shadcn: `dialog`, `calendar`, `popover`, `card`, `badge`, `button`, `separator`, `skeleton` ya instalados. **Ningún `npx shadcn@latest add`.**
- `src/modules/orders/` existe con las carpetas **vacías**: se llena, no se crea.

## Criterios de aceptación
- [ ] AC1 — Sin sesión, `/profile/compras` redirige a `/sign-in` y `GET /api/orders` responde 401.
- [ ] AC2 — `GET /api/orders` devuelve **solo** órdenes con `userId` del usuario de `requireAuth()`; un `userId` inyectado en la query se ignora (Zod no lo acepta).
- [ ] AC3 — Sin parámetros, la vista muestra el mes actual; el listado viene ordenado por `createdAt` desc y agrupado bajo un encabezado por día con día, mes y año.
- [ ] AC4 — Con `Rango`, elegir dos fechas actualiza la URL (`period=custom&from&to`) y el listado; recargar conserva el filtro.
- [ ] AC5 — Un rango sin compras muestra el estado vacío, no un error ni un spinner infinito.
- [ ] AC6 — Ninguna orden `canceled` aparece en la respuesta (D5).
- [ ] AC7 — Abrir el Dialog muestra todas las líneas con `nameSnapshot`, cantidad, precio unitario congelado y total, **sin** un request adicional al listado (D2).
- [ ] AC8 — En una orden `paid`, "Descargar boleta" abre una URL de `pay.stripe.com/receipts/...` en pestaña nueva.
- [ ] AC9 — `GET /api/orders/<id ajeno>/receipt` → 404, nunca la boleta de otro; con un `id` no-uuid → 400.
- [ ] AC10 — En una orden `pending_payment` o `payment_failed` el botón de boleta no se renderiza, y llamar al endpoint a mano → 409.
- [ ] AC11 — `STRIPE_SECRET_KEY` no aparece en ninguna respuesta ni en el bundle del cliente; `src/lib/stripe.ts` no se importa desde `src/modules/`.
- [ ] AC12 — `npm run typecheck && npm run lint && npm run build` en verde.

## Tareas
- [x] T1 — `listByUser(userId, params)`: filtra `userId`, `ne(status,'canceled')`, `gte/lte` de `createdAt`, `orderBy desc`, `limit`; carga las líneas con un solo `inArray` · `src/server/repositories/order.repository.ts`
- [x] T2 — `ordersQuerySchema` y `orderFiltersSchema` + tipos inferidos · `src/modules/orders/schemas/order.schema.ts`
- [x] T3 — `OrderListItemDto` (`Serialized<Order>` + items) y `toOrderListItemDto` · `src/modules/orders/types/index.ts`
- [x] T4 — Route Handler `GET`: `requireAuth()` + Zod + repo + `toErrorResponse` · `src/app/api/orders/route.ts`
- [x] T5 — `getReceiptUrl(orderId, userId)`: `findByIdWithItems`, valida propietario (404) y estado (409), `paymentIntents.retrieve` con `expand: ["latest_charge"]` (D1) · `src/server/services/order-receipt.service.ts`
- [x] T6 — Route Handler `GET` de boleta con `params` validados por `z.uuid()` · `src/app/api/orders/[id]/receipt/route.ts`
- [x] T7 — Services axios `fetchMyOrders(query)` y `fetchOrderReceipt(id)` · `src/modules/orders/services/order.service.ts`
- [x] T8 — Etiquetas de estado y `MAX_ORDERS` · `src/modules/orders/constants.ts`
- [x] T9 — Helper puro `groupOrdersByDay(orders)` → `{ dayKey, label, orders }[]` en hora local (D3) · `src/modules/orders/utils.ts`
- [x] T10 — `orderKeys`, `useMyOrders(query)` y `useOrderFilters()` (URL ↔ schema, preset mes actual) · `src/modules/orders/hooks/use-my-orders.ts`
- [x] T11 — `useOrderReceipt(orderId, enabled)` con `enabled` atado a la apertura del Dialog · `src/modules/orders/hooks/use-order-receipt.ts`
- [x] T12 — Filtro: chips mes/rango + `Popover` con `Calendar mode="range"` · `src/modules/orders/components/order-history-filters.tsx`
- [x] T13 — `Card` de una compra con id corto, hora, artículos, total y `Badge` de estado · `src/modules/orders/components/order-card.tsx`
- [x] T14 — `Dialog` de detalle: líneas, totales y botón de boleta con estados `pending`/error · `src/modules/orders/components/order-detail-dialog.tsx`
- [x] T15 — Contenedor cliente: filtros, `Skeleton`, error, vacío, aviso de `truncated` y render por grupos · `src/modules/orders/components/order-history.tsx`
- [x] T16 — Reemplazar el placeholder por la composición de `OrderHistory`, conservando `metadata` · `src/app/(storefront)/profile/compras/page.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- **`receipt_url` puede ser null** aunque la orden esté `paid` (Stripe la genera al asentarse el cargo). El 409 de T5 cubre ese caso con un mensaje accionable ("la boleta aún no está disponible"), no un 500.
- **Órdenes de 008 sin `stripePaymentIntentId`.** Las pagadas antes de que el webhook corriera bien quedan sin PaymentIntent: caen en el mismo 409, sin romper la fila ni el Dialog.
- **Frontera del día.** `from`/`to` viajan como ISO absoluto calculado en el navegador; el servidor no reinterpreta zonas horarias. Un pedido de las 23:50 se agrupa en el día local del comprador, que es lo que él recuerda.
