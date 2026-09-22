---
id: 014
title: Módulo de inventario (kardex, ajustes y umbral por producto)
status: done
module: products
scope: admin
---

# 014 — Módulo de inventario (kardex, ajustes y umbral por producto)

## Objetivo
Un administrador puede ver, ajustar y auditar el stock de cada producto con un kardex
append-only que cuadra con `products.stock`, para que ninguna entrada o salida quede sin rastro.

## Alcance
Incluye: tabla `stock_movements`, listado de inventario, kardex por producto, ajuste manual
(`adjustment`/`waste`/`restock`), movimientos automáticos `sale` y `return`, umbral de stock bajo
por producto, permisos `inventory.*`, backfill `initial`, auditoría.
No incluye: bodegas, proveedores, órdenes de compra, importación CSV, reserva de stock en carrito,
reembolso en Stripe (la cancelación solo repone stock).

## Criterios de aceptación
- [ ] AC1 — Dado un producto con stock 10, cuando un admin registra `waste` qty 3 con motivo, entonces `stock` queda en 7 y se escribe un movimiento `qty_delta = -3`, `stock_after = 7`.
- [ ] AC2 — Dado un conteo físico, cuando el `expectedStock` enviado ya no coincide con la BD, entonces responde 409 y no se escribe movimiento.
- [ ] AC3 — Dado `adjustment` o `waste` sin `reason`, cuando se envía el POST, entonces responde 400.
- [ ] AC4 — Dado un pago confirmado, cuando corre `fulfillOrder`, entonces cada línea genera un movimiento `sale` en la misma transacción; una reentrega del webhook no lo duplica.
- [ ] AC5 — Dado un pedido `paid|processing|shipped`, cuando un admin lo cancela, entonces se genera un `return` por línea que repone stock; repetir la cancelación no repone dos veces.
- [ ] AC6 — Dado cualquier producto, cuando se suma `qty_delta` de todo su kardex, entonces el total es igual a `products.stock`.
- [ ] AC7 — Dado un producto con `stock < 0` (sobreventa de 008), cuando se abre el listado, entonces aparece marcado como alerta y sigue siendo ajustable; el pago no se bloquea.
- [ ] AC8 — Dado un usuario sin `inventory.read`, cuando llama a `GET /api/admin/inventory`, entonces responde 403; sin `inventory.adjust`, el POST responde 403.
- [ ] AC9 — Dado el PATCH de producto de 003, cuando el body incluye `stock`, entonces el campo se rechaza: el stock solo cambia vía `stock_movements`.
- [ ] AC10 — Dado un producto con `lowStockThreshold = 2` y stock 3, cuando se abre el dashboard, entonces no figura en la card de stock bajo.
- [ ] AC11 — Cada ajuste manual escribe `audit_logs` (`inventory.adjusted`) en la misma transacción.
- [ ] AC12 — Listado, kardex y diálogo de ajuste muestran estado de carga y mensaje de error.

## Datos
Migración requerida (`npm run db:generate` + edición manual del `.sql` para el backfill).

`products` · `low_stock_threshold` · `integer` · `NOT NULL DEFAULT 5` — reemplaza la constante fija de 013.

Nueva tabla `stock_movements` (`src/server/db/schema/stock-movement.ts`):
- `id` uuid PK · `product_id` uuid NOT NULL → `products.id` `ON DELETE CASCADE`
- `type` enum `stock_movement_type` (`initial`,`sale`,`return`,`adjustment`,`waste`,`restock`) NOT NULL
- `qty_delta` integer NOT NULL · `CHECK (qty_delta <> 0)`
- `stock_after` integer NOT NULL — valor del `RETURNING` del UPDATE
- `reason` text NULL · `CHECK (type NOT IN ('adjustment','waste') OR reason IS NOT NULL)`
- `reference_type` text NULL / `reference_id` uuid NULL — `'order'` + id para `sale`/`return`
- `actor_id` uuid NULL → `users.id` `ON DELETE SET NULL` (NULL = automático del webhook)
- `created_at` timestamptz NOT NULL default now · `index (product_id, created_at DESC)`
- `unique (reference_type, reference_id, product_id, type) WHERE reference_id IS NOT NULL` — candado de idempotencia de `sale`/`return`

Backfill en la misma migración: `INSERT INTO stock_movements (product_id, type, qty_delta, stock_after, created_at) SELECT id, 'initial', stock, stock, now() FROM products WHERE stock <> 0 AND NOT EXISTS (SELECT 1 FROM stock_movements);`

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/inventory` | `inventory.read` | — | `{ data: InventoryRowDto[], meta: { total } }` |
| GET | `/api/admin/inventory/[productId]/movements` | `inventory.read` | — | `{ data: StockMovementDto[], meta: { total } }` |
| POST | `/api/admin/inventory/[productId]/movements` | `inventory.adjust` | ajuste | `StockMovementDto` |
| PATCH | `/api/admin/orders/[id]` (existente) | `orders.update_status` | `{ status: "canceled" }` | `AdminOrderDto` |

Zod en `src/modules/inventory/schemas/inventory.schema.ts`:
- `inventoryQuerySchema`: `q?`, `filter?` (`all|low|negative`), `page`, `pageSize`.
- `movementsQuerySchema`: `type?`, `page`, `pageSize`.
- `createStockMovementSchema`: `discriminatedUnion("type")` → `adjustment` (`countedStock` int ≥0, `expectedStock` int, `reason` ≥3) · `waste` (`qty` int >0, `reason` ≥3) · `restock` (`qty` int >0, `reason?`).
- `updateOrderStatusSchema` (012) amplía su enum con `canceled`.

## Reutilizar
- `src/lib/permissions.ts` `requirePermission` · `src/lib/permissions.catalog.ts` · `src/modules/roles/constants.ts` `SYSTEM_ROLES` (el seed hace upsert sin revocar).
- `src/lib/audit.ts` `logAudit`/`diffChanges` · `src/server/db/pool.ts` `dbTx`, `Executor`, `ReadExecutor`.
- `src/server/repositories/product.repository.ts` — `findById`, `listLowStock` (pasa a leer la columna); `decrementStock` **se elimina**, lo sustituye el servicio de movimientos.
- `src/server/services/order-fulfillment.service.ts` `fulfillOrder` — punto de integración de `sale`.
- `src/server/services/order-status.service.ts` — punto de integración de `return`; hoy solo avanza estados, hay que añadir la cancelación.
- `src/modules/orders/constants.ts` `ORDER_FULFILLMENT_NEXT`, `ORDER_STATUS_VIEW`.
- `src/components/shared/data-table.tsx` + `createDataTableColumnHelper` · `admin-shell.tsx` `NAV_ITEMS`.
- `src/modules/orders/hooks/use-admin-orders.ts` y `services/admin-order.service.ts` — patrón hook + axios + filtros en URL a calcar.
- `src/modules/products/components/product-form-dialog.tsx` — patrón RHF + Zod para el diálogo de ajuste.
- `src/lib/axios.ts` `api` · `src/lib/api-error.ts` `ConflictError`, `NotFoundError`, `toErrorResponse`.
- Sin componentes shadcn nuevos: `dialog`, `sheet`, `select`, `field`, `badge`, `table`, `skeleton` ya están instalados.

## Tareas
- [x] T1 — Schema de `stock_movements` + enum + `lowStockThreshold` en products · `src/server/db/schema/stock-movement.ts`, `schema/product.ts`, `schema/index.ts`
- [x] T2 — Migración generada + backfill `initial` escrito a mano en el `.sql` · `drizzle/0009_colorful_polaris.sql`
- [x] T3 — Permisos `inventory.read`/`inventory.adjust` y su concesión a roles · `src/lib/permissions.catalog.ts`, `src/modules/roles/constants.ts`
- [x] T4 — Repositorio de movimientos (`insert`, `listByProduct`, `sumQtyDelta`, `findByReference`) · `src/server/repositories/stock-movement.repository.ts`
- [x] T5 — Mutadores atómicos (`applyStockDelta` con `stock + delta RETURNING`, `setStockIfUnchanged` con `WHERE stock = :expected`) y baja de `decrementStock` · `src/server/repositories/product.repository.ts`
- [x] T6 — `listInventory` paginado y `listLowStock` contra `low_stock_threshold` · `src/server/repositories/product.repository.ts`
- [x] T7 — Servicio: `adjustStock`, `recordSaleMovements`, `recordReturnMovements`, `recordInitialMovement` + audit · `src/server/services/inventory.service.ts`
- [x] T8 — Test unitario del cálculo de delta/signo por tipo (skill `test-unit`) · `src/server/services/inventory.math.ts`, `inventory.math.test.ts`
- [x] T9 — `fulfillOrder` emite `sale` vía el servicio en vez de `decrementStock` · `src/server/services/order-fulfillment.service.ts`
- [x] T10 — Cancelación de pedido pagado (`paid|processing|shipped` → `canceled`) que emite `return` · `src/server/services/order-status.service.ts`, `src/modules/orders/constants.ts`, `src/modules/orders/schemas/admin-order.schema.ts`
- [x] T11 — `createProduct` emite `initial`; `updateProduct` deja de aceptar `stock` y acepta `lowStockThreshold` · `src/server/services/product.service.ts`, `src/modules/products/schemas/product.schema.ts`
- [x] T12 — Formulario de producto: `stock` solo lectura en edición, campo de umbral · `src/modules/products/components/product-form-dialog.tsx`
- [x] T13 — Dashboard sin `LOW_STOCK_THRESHOLD`: service y rótulo de la card por umbral propio · `src/modules/dashboard/constants.ts`, `src/server/services/dashboard-metrics.service.ts`, `src/modules/dashboard/components/low-stock-card.tsx`
- [x] T14 — Schemas Zod y DTOs del módulo · `src/modules/inventory/schemas/inventory.schema.ts`, `src/modules/inventory/types/inventory.ts`
- [x] T15 — Handlers con `requirePermission` · `src/app/api/admin/inventory/route.ts`, `src/app/api/admin/inventory/[productId]/movements/route.ts`
- [x] T16 — Middleware: `/admin/inventory` y `/api/admin/inventory` autenticados, sin la exención de 003 · `src/middleware.ts`
- [x] T17 — Servicios axios · `src/modules/inventory/services/inventory.service.ts`
- [x] T18 — Hooks TanStack Query (listado, kardex, mutación con invalidación) · `src/modules/inventory/hooks/use-inventory.ts`
- [x] T19 — Tabla de inventario con filtros y badge de alerta · `src/modules/inventory/components/inventory-table.tsx`, `inventory-filters.tsx`, `constants.ts`
- [x] T20 — Diálogo de ajuste con RHF + `createStockMovementSchema` · `src/modules/inventory/components/stock-adjust-dialog.tsx`
- [x] T21 — Sheet de kardex por producto · `src/modules/inventory/components/stock-movements-sheet.tsx`
- [x] T22 — Gestor, página y enlace de navegación · `src/modules/inventory/components/inventory-manager.tsx`, `src/app/(admin)/admin/inventory/page.tsx`, `src/components/shared/admin-shell.tsx`
- [x] T23 — Acción "Cancelar pedido" en la tabla de pedidos · `src/modules/orders/components/admin-order-table.tsx`, `admin-order-manager.tsx`, `hooks/use-admin-orders.ts`

Verificación final: `npm run typecheck && npm run lint && npm run build` en verde · `npm test` 153/153.

## Decisiones tomadas / supuestos
- D1 — `qty_delta` entero **con signo** + `type`, en vez de tipo + cantidad positiva: la conciliación del AC6 es un único `SUM(qty_delta)`, sin `CASE` por tipo en cada agregación. El signo lo fija el servicio según el tipo; la API nunca recibe signos del cliente.
- D2 — `stock_after` se persiste con el `RETURNING` del UPDATE: kardex legible sin recalcular y descuadres detectables.
- D3 — `adjustment` usa `countedStock` + `expectedStock` (bloqueo optimista, 409 si cambió); `waste`/`restock` usan `qty` positiva con UPDATE incremental. Ninguno lee-modifica-escribe.
- D4 — `ON DELETE CASCADE` en `product_id`: con `RESTRICT`, el backfill `initial` haría fallar el DELETE de producto de 003 en todo el catálogo.
- D5 — Roles: `super_admin`/`admin` reciben ambos permisos por `ALL_PERMISSIONS`; `manager` ambos; `employee` y `audit` solo `inventory.read`. **Confirmado por el humano en la aprobación: `employee` no ajusta.**
- D6 — La cancelación de pedido pagado no existe en 012 y se añade aquí (T10/T23) bajo el permiso `orders.update_status` ya existente. **Confirmado: sin permiso nuevo ni spec aparte.**
- D7 — El umbral se edita desde el formulario de producto (`products.update`), no desde inventario: evita un endpoint extra.

## Notas
- Un pedido con dos líneas del mismo producto rompería el índice único de idempotencia: agregar por `productId` sumando `qty` antes de insertar los movimientos de `sale`/`return`.
- El listado no debe resolver el último movimiento fila por fila (N+1): join lateral o prescindir del dato.
- `sale` conserva el "sin clamp" de 008 —el stock puede quedar negativo y el kardex lo refleja— y 011 (`expired`) sigue sin generar movimientos: esa orden nunca descontó stock.

## Notas de implementación (014, cierre)

- Archivos fuera de la lista de tareas, ambos derivados de ella: `src/server/services/inventory.math.ts`
  (las funciones puras que exige el `inventory.math.test.ts` de T8, colocadas según SETUP §8.1) y
  `src/modules/inventory/constants.ts` (etiquetas de tipo de movimiento y semáforo de stock,
  compartidas por tabla, kardex y diálogo).
- `updateOrderStatusSchema` ya aceptaba `canceled` desde 012: no hizo falta ampliar el enum, solo
  darle destino real. El `PATCH` entra por `changeOrderStatus`, que enruta a `cancelOrder` o a
  `advanceOrderStatus`; la transición sigue validándose contra la BD y responde 409.
- `adjustment` con `countedStock === expectedStock` responde **400** ("no hay nada que ajustar"):
  el CHECK `qty_delta <> 0` lo rechazaría con un error opaco.
- La alerta del dashboard enlaza ahora a `/admin/inventory?q=…` en vez de a productos.
- `npm run db:seed:catalog` ya no descuadra el AC6 (era el pendiente conocido del primer cierre):
  el UPSERT dejó de escribir `stock` —el de un producto existente solo lo mueve el kardex— y las
  filas realmente nuevas salen por `RETURNING` y pasan por `recordInitialMovement`, dentro de la
  misma transacción del seed. El script puede importar `inventory.service` bajo `tsx` sin arrastrar
  el runtime de Next (verificado ejecutando el import).
- **Toca 008**: `markPaid` y el guard de `fulfillOrder` pasan de "cualquier estado menos `paid`" a
  `pending_payment | payment_failed`. Son los dos únicos orígenes legítimos de un cobro
  (`async_payment_failed` → `async_payment_succeeded` sigue funcionando; `expired` nunca vuelve a
  pagarse porque la sesión caducó, 011 AC3). Sin este cambio, una reentrega tardía de
  `checkout.session.completed` devolvía a `paid` un pedido `processing|shipped|delivered` y
  resucitaba uno `canceled` que ya tenía su `return` en el kardex.
- El tope de `qty`/`countedStock`/`expectedStock` (1.000.000) vive en el schema del módulo y se
  replica en el `superRefine` del formulario: un formulario válido no puede producir un body
  inválido, que era la vía del fallo silencioso del diálogo de ajuste.
- `formatDateTime` se centraliza en `src/lib/utils.ts` (inventario y pedidos). `category-table.tsx`
  conserva el suyo: formatea solo fecha (`dateStyle: "medium"`), no es el mismo formato.
