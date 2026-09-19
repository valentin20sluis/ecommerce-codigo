---
id: 012
title: Gestión de pedidos en el admin
status: done
module: orders
scope: admin
---

# 012 — Gestión de pedidos en el admin

## Objetivo
Un administrador puede listar, filtrar y avanzar el estado de fulfillment de las
órdenes (`paid → processing → shipped → delivered`) desde el panel, con traza en
`audit_logs`.

## Alcance
Incluye:
- Ampliación del enum `order_status` con `processing`, `shipped`, `delivered`.
- `GET /api/admin/orders` paginado, con filtros de estado, cliente y rango de fecha.
- `PATCH /api/admin/orders/[id]` para avanzar un paso la transición.
- Página `/admin/orders` con tabla, filtros y cambio de estado inline.
- Permisos `orders.read` y `orders.update_status`.

No incluye:
- Cancelación y reembolso (siguen manuales vía Stripe Dashboard).
- Retroceder o saltar estados; ni transiciones desde `pending_payment`, `payment_failed`, `canceled`, `expired`.
- Vista de detalle de líneas de la orden, guías de envío, notificación al cliente.
- Cambios en los roles `employee` y `audit`.

## Decisiones
| # | Decisión | Motivo |
|---|---|---|
| D1 | El admin vive dentro de `src/modules/orders/` con prefijo `admin-` en archivos, no en un módulo nuevo | Mismo dominio: reutiliza `ORDER_STATUS_VIEW` y `Serialized<Order>`; un `admin-orders/` duplicaría el mapa de etiquetas |
| D2 | La transición vive en un único mapa `ORDER_FULFILLMENT_NEXT` en `src/modules/orders/constants.ts` | Lo consume el service (validación) y el `Select` inline (siguiente estado); el archivo ya es client-safe |
| D3 | La transición la valida el service → `ConflictError` (409); Zod solo comprueba pertenencia al enum | Mismo criterio que `product.service.ts`: la regla de negocio necesita el estado actual en BD |
| D4 | El guard de estado de origen viaja en el `WHERE` del `UPDATE` (`eq(status, from)`) | Dos admins pulsando a la vez: el segundo no devuelve fila y recibe 409, sin auditar dos veces |
| D5 | `customer` filtra con `ILIKE '%txt%'` sobre `users.email`, `firstName`, `lastName` unidos por `or()` | Texto libre, a diferencia del `actorId` exacto de audit-logs |
| D6 | "Todos los estados" no envía el parámetro `status` (centinela local `__all__`) | Patrón `ANY_SEVERITY` ya usado en `audit-log-filters.tsx`; evita un valor `"all"` en Zod |
| D7 | Nuevo `src/server/services/order-status.service.ts`; no se toca `order-fulfillment.service.ts` | Ese archivo es la superficie del webhook de Stripe (SRP) |
| D8 | Solo `manager` gana los permisos explícitamente en el catálogo de roles | `super_admin` usa `ALL_PERMISSIONS` y `admin` el filtro de gobernanza: heredan automático (verificado en `src/modules/roles/constants.ts`) |
| D9 | Sin cambios en `middleware.ts` | `/admin/orders` y `/api/admin/orders` no están en `isUnauthenticatedRoute`, así que ya exigen sesión por `isAdminRoute` |

## Datos
- `src/server/db/schema/order.ts` · `ORDER_STATUSES`: agregar `"processing"`, `"shipped"`, `"delivered"` **después** de `"paid"`, sin renombrar ni reordenar los existentes. El comentario del archivo ya anticipa este spec: actualizarlo.
- Requiere migración: `npm run db:generate` (ALTER TYPE … ADD VALUE, additivo) + `npm run db:migrate`.
- Sin tablas ni columnas nuevas. `orders.updatedAt` se refresca en el UPDATE.
- Índice: no se agrega; el listado ordena por `created_at desc` sin partición por usuario y el volumen del proyecto no lo justifica.

## API
| Método | Ruta | Permiso | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/orders` | `orders.read` | Query: `status?`, `customer?`, `from?`, `to?`, `page`, `pageSize` | `Paginated<AdminOrderListItem>` |
| PATCH | `/api/admin/orders/[id]` | `orders.update_status` | `{ status }` | `Serialized<Order>` · 404 si no existe · 409 si la transición no es la siguiente válida |

Zod en `src/modules/orders/schemas/admin-order.schema.ts`:
- `adminOrdersQuerySchema`: `status` (`z.enum(ORDER_STATUSES)` duplicado local, mismo criterio que `audit-log.schema.ts`), `customer` (`string().max(120)`), `from`/`to` (`z.iso.datetime()`), `page` (`coerce.number().int().min(1).default(1)`), `pageSize` (`…max(100).default(20)`).
- `updateOrderStatusSchema`: `{ status: z.enum(ORDER_STATUSES) }`.

Auditoría: `action: "order.status_changed"`, `entityType: "order"`, `changes` vía `diffChanges({ status: before }, { status: after })`, en la misma transacción `dbTx.transaction` + `logAudit`.

## Reutilizar
- `src/lib/auth.ts` — `getCurrentUser`, `requireAuth`, `requireAdmin` (el layout ya guarda el panel).
- `src/lib/permissions.ts` — `requirePermission`; catálogo en `src/lib/permissions.catalog.ts`.
- `src/lib/api-error.ts` — `toErrorResponse`, `NotFoundError`, `ConflictError`.
- `src/lib/audit.ts` — `logAudit`, `diffChanges`; `src/server/db/pool.ts` — `dbTx`, `Executor`, `ReadExecutor`.
- `src/server/services/product.service.ts` (`updateProduct`) — plantilla exacta de service transaccional con auditoría.
- `src/server/repositories/audit-log.repository.ts` (`listPaginated`) — plantilla exacta de repo paginado (`SQL[]`, `count(*)::int`, `leftJoin(users)`, `orderBy(desc)`, `limit/offset`).
- `src/server/repositories/order.repository.ts` — se le agregan `listPaginated` y `updateStatus` (nombre `listPaginated` ya usado en `product.repository.ts` y `audit-log.repository.ts`).
- `src/components/shared/data-table.tsx` — `DataTable` + `createDataTableColumnHelper`: ya trae skeleton de carga, error, vacío y paginación server-side.
- `src/modules/audit/hooks/use-audit-logs.ts` — plantilla de hook URL ⇄ query + `keepPreviousData`.
- `src/modules/audit/components/audit-log-filters.tsx` — patrón `Popover` + `Calendar mode="range"` y centinela de `Select`.
- `src/modules/orders/constants.ts` — `ORDER_STATUS_VIEW` (extender con los tres estados nuevos).
- `src/lib/utils.ts` — `formatPriceFromCents`; `src/lib/axios.ts` — `api`; `src/types/api.ts` — `Paginated`, `Serialized`.
- `src/components/shared/admin-shell.tsx` — `NAV_ITEMS` (agregar "Pedidos").
- shadcn ya instalados, **no reinstalar**: `table`, `select`, `dropdown-menu`, `badge`, `popover`, `calendar`, `skeleton`, `button`, `input`, `label`.

## Criterios de aceptación
- [ ] AC1 — Dado un admin con `orders.read`, cuando abre `/admin/orders`, entonces ve las órdenes paginadas (20 por página) ordenadas por fecha descendente, con id corto, cliente, fecha, total formateado y `Badge` de estado.
- [ ] AC2 — Dado el filtro de estado en `processing`, cuando se aplica, entonces la URL lleva `status=processing&page=1` y la tabla solo muestra esas órdenes; recargar conserva el filtro.
- [ ] AC3 — Dado el filtro de cliente con texto parcial, cuando se aplica, entonces devuelve órdenes cuyo email, nombre o apellido coincide sin distinguir mayúsculas.
- [ ] AC4 — Dado un rango de fechas, cuando se aplica, entonces solo se listan órdenes con `created_at` dentro del rango.
- [ ] AC5 — Dada una orden en `paid`, cuando el admin abre el control de estado, entonces la única opción ofrecida es `processing`; en `delivered` no hay opción y el control aparece deshabilitado.
- [ ] AC6 — Dada una orden en `paid`, cuando se envía `PATCH { status: "processing" }`, entonces responde 200, la fila se refresca y `audit_logs` gana una entrada `order.status_changed` con `before.status="paid"` y `after.status="processing"`.
- [ ] AC7 — Dada una orden en `paid`, cuando se envía `PATCH { status: "delivered" }` o `{ status: "paid" }`, entonces responde 409 y no se escribe nada en `orders` ni en `audit_logs`.
- [ ] AC8 — Dada una orden en `pending_payment`, `payment_failed`, `canceled` o `expired`, cuando se intenta cualquier `PATCH`, entonces responde 409.
- [ ] AC9 — Dado un `id` inexistente, cuando se envía `PATCH`, entonces responde 404.
- [ ] AC10 — Dado un usuario sin `orders.update_status`, cuando envía `PATCH`, entonces responde 403; sin `orders.read`, el `GET` responde 403.
- [ ] AC11 — Dado `db:seed` ejecutado, entonces el rol `manager` tiene `orders.read` y `orders.update_status`, y `employee`/`audit` no.
- [ ] AC12 — Dada la tabla cargando, con error o sin resultados, entonces se muestra skeleton, mensaje de error y mensaje de vacío respectivamente.

## Tareas
- [x] T1 — Agregar `processing`, `shipped`, `delivered` a `ORDER_STATUSES` y actualizar el comentario · `src/server/db/schema/order.ts`
- [x] T2 — Generar y aplicar la migración (`db:generate` + `db:migrate`) · `drizzle/`
- [x] T3 — Agregar `ORDERS_READ` y `ORDERS_UPDATE_STATUS` con sus descripciones · `src/lib/permissions.catalog.ts`
- [x] T4 — Conceder ambos permisos al rol `manager` · `src/modules/roles/constants.ts`
- [x] T5 — Extender `ORDER_STATUS_VIEW` y agregar `ORDER_FULFILLMENT_NEXT` · `src/modules/orders/constants.ts`
- [x] T6 — Agregar `listPaginated` (filtros + `leftJoin(users)` + total) y `updateStatus` (guard de estado de origen en el WHERE) · `src/server/repositories/order.repository.ts`
- [x] T7 — Crear `adminOrdersQuerySchema` y `updateOrderStatusSchema` · `src/modules/orders/schemas/admin-order.schema.ts`
- [x] T8 — Crear `advanceOrderStatus(actor, id, next)` con transacción, validación de transición y `logAudit` · `src/server/services/order-status.service.ts`
- [x] T9 — Implementar `GET` con `requirePermission(PERMISSIONS.ORDERS_READ)` · `src/app/api/admin/orders/route.ts`
- [x] T10 — Implementar `PATCH` con `requirePermission(PERMISSIONS.ORDERS_UPDATE_STATUS)` · `src/app/api/admin/orders/[id]/route.ts`
- [x] T11 — Definir `AdminOrderListItem` y su mapeo a DTO · `src/modules/orders/types/admin-order.ts`
- [x] T12 — Crear el service axios (`fetchAdminOrders`, `updateOrderStatus`) · `src/modules/orders/services/admin-order.service.ts`
- [x] T13 — Crear `useAdminOrders`, `useAdminOrderFilters` y la mutación con invalidación de la key · `src/modules/orders/hooks/use-admin-orders.ts`
- [x] T14 — Crear los filtros (estado, cliente, rango de fecha, reset) · `src/modules/orders/components/admin-order-filters.tsx`
- [x] T15 — Crear la tabla con `DataTable` y la celda de cambio de estado · `src/modules/orders/components/admin-order-table.tsx`
- [x] T16 — Crear el contenedor que une filtros, tabla y mutación · `src/modules/orders/components/admin-order-manager.tsx`
- [x] T17 — Crear la página con `metadata` y `Suspense` · `src/app/(admin)/admin/orders/page.tsx`
- [x] T18 — Agregar "Pedidos" a `NAV_ITEMS` · `src/components/shared/admin-shell.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- Órdenes históricas quedan en `paid` tras la migración: el flujo de fulfillment arranca desde ahí sin backfill.
- El `GET` no trae `order_items`: una consulta por página, sin N+1. Si luego se pide el detalle, será otro spec.
- El rol `audit` no verá pedidos hasta que un spec posterior le dé `orders.read`; es intencional aquí.
