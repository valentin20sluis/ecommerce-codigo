---
id: 015
title: Finanzas — Fase 1: Precio unitario (costo y margen por producto)
status: done
module: finance
scope: admin
---

# 015 — Finanzas — Fase 1: Precio unitario (costo y margen por producto)

## Objetivo
Un operador con `finance.read` abre `/admin/finance/unit-price` y ve, por producto, el
precio de venta, el costo unitario y el margen resultante; uno con `finance.manage_costs`
puede editar ese costo. Esta fase también empieza a congelar el costo en cada línea de
pedido, dejando la base de datos lista para que fases futuras (Ganancias) calculen el
margen realmente ganado en cada venta, no solo el margen de catálogo de hoy.

## Contexto — roadmap del módulo de Finanzas
Este spec es la fase 1 de 6, acordadas por brainstorming (sin spec previo, ver commit de
este archivo). Orden y dependencias:

| # | Fase | Depende de |
|---|---|---|
| **1** | **Precio Unitario (este spec)** | — |
| 2 | Ingresos | — |
| 3 | Egresos | — |
| 4 | Impuestos (venta + utilidad) | 1, 2, 3 |
| 5 | Ganancias (estado de resultados) | 1, 2, 3, 4 |
| 6 | Contabilidad (registro consolidado) | 2, 3 |

## Alcance
Incluye:
- Columna `cost_cents` en `products` (costo unitario actual, editable).
- Columna `cost_cents_snapshot` en `order_items` (costo congelado al momento de la venta).
- Permisos `finance.read` / `finance.manage_costs`.
- Página `/admin/finance/unit-price`: tabla con precio, costo, margen $ y margen % por producto.
- Endpoint de lectura paginada y endpoint de edición de costo, con auditoría.

No incluye:
- Reporte de margen histórico/realizado por venta (fase Ganancias; el dato queda
  capturado en `cost_cents_snapshot` pero no se explota aquí).
- Historial de cambios de costo más allá de lo que ya registra `audit_logs`.
- Costo por lote, por proveedor o costo promedio ponderado.
- Edición de costo desde `product-form-dialog.tsx` (queda fuera de Finanzas a propósito).

## Decisiones
| # | Decisión |
|---|---|
| D1 | `cost_cents` **nullable, sin default**. Los productos existentes no tienen costo hoy; forzar `0` mostraría un margen del 100% falso. Mientras esté vacío, el margen se muestra como "sin dato". |
| D2 | `cost_cents_snapshot` se congela en el mismo punto donde hoy se congelan `nameSnapshot`/`unitPriceCents` (`src/server/services/checkout.service.ts`, creación de la sesión de checkout), leyendo el `costCents` del producto en ese instante. Si el producto no tenía costo cargado, el snapshot queda `NULL` para siempre: no se rellena retroactivamente porque falsearía el margen histórico. |
| D3 | El costo se edita en una página propia de Finanzas, no en el formulario de producto: un rol sin `finance.manage_costs` no debe ver el campo ni siquiera oculto/deshabilitado dentro de un formulario que sí puede abrir. Separa responsabilidades de catálogo (`products.*`) y de finanzas (`finance.*`). |
| D4 | Dos permisos nuevos en `src/lib/permissions.catalog.ts`: `finance.read` (ver costo/margen y, a futuro, el resto de reportes de Finanzas) y `finance.manage_costs` (editar el costo). Propuesta de asignación (a confirmar/ajustar en la aprobación humana de este spec): `super_admin`/`admin` ambos; `manager` y `audit` solo `finance.read`; `employee` ninguno. |
| D5 | El margen se calcula como `priceCents - costCents` (y `%` sobre `priceCents`). Si `costCents` es `NULL`, la fila muestra "sin dato" en vez de `0%` o `NaN`; no se computa. |
| D6 | Sin tabla nueva ni historial de costos: el rastro de cambios lo cubre `audit_logs` (`finance.cost_updated`, `{ before, after }`), igual que el resto de mutaciones admin. |

## Datos
Migración Drizzle (`npm run db:generate`), sin backfill porque ambas columnas nacen
`NULL`-eables:

- `products` · `cost_cents` · `integer` · nullable, sin default.
- `order_items` · `cost_cents_snapshot` · `integer` · nullable.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/unit-price?q=&page=&pageSize=` | `finance.read` | — | `{ data: UnitPriceRowDto[], meta: { total } }` |
| PATCH | `/api/admin/finance/unit-price/[productId]` | `finance.manage_costs` | `{ costCents: number \| null }` | `UnitPriceRowDto` |

`UnitPriceRowDto`: `{ productId, name, sku, priceCents, costCents, marginCents, marginPercent }`,
con `costCents`/`marginCents`/`marginPercent` en `null` cuando no hay costo cargado.

Zod en `src/modules/finance/schemas/unit-price.schema.ts`: `unitPriceQuerySchema` (`q?`,
`page`, `pageSize`, patrón de `inventoryQuerySchema`) y `updateCostSchema`
(`costCents: z.number().int().min(0).max(...)` o `z.null()`).

`middleware.ts` protege `/admin/finance(.*)` y `/api/admin/finance(.*)` igual que el resto
de rutas admin.

## UI
Nueva entrada **Finanzas** en `admin-shell.tsx` (`NAV_ITEMS`), gated por `finance.read`, con
subpágina `/admin/finance/unit-price`. Tabla con el patrón `data-table.tsx` (igual que
inventario): columnas Producto, SKU, Precio, Costo, Margen $, Margen %. Acción "Editar
costo" abre un diálogo (RHF + Zod, patrón `stock-adjust-dialog.tsx`) visible solo con
`finance.manage_costs`.

Estados obligatorios: `Skeleton` en carga, mensaje de error con reintento, vacío explícito
("Sin productos"), y por fila el margen "sin dato" descrito en D5.

## Reutilizar
- `src/lib/permissions.ts` (`requirePermission`) y `src/lib/permissions.catalog.ts` — alta de los dos permisos nuevos.
- `src/modules/roles/constants.ts` (`SYSTEM_ROLES`) — asignación por rol (D4).
- `src/lib/audit.ts` (`logAudit`, `diffChanges`) — auditoría del PATCH.
- `src/server/db/pool.ts` (`dbTx`, `Executor`, `ReadExecutor`) — transacción del PATCH.
- `src/server/repositories/product.repository.ts` — lectura/actualización de `costCents`, mismo archivo que ya tiene `findById`/`listLowStock`.
- `src/server/services/checkout.service.ts` — punto de integración de D2 (`cost_cents_snapshot` junto a `nameSnapshot`/`unitPriceCents`).
- `src/components/shared/data-table.tsx` + `createDataTableColumnHelper`, `admin-shell.tsx` `NAV_ITEMS`.
- `src/modules/inventory/` — plantilla completa de módulo (schema, service, hook, tabla, diálogo) a calcar para `src/modules/finance/`.
- `src/lib/axios.ts` (`api`), `src/lib/api-error.ts` (`toErrorResponse`, `NotFoundError`).
- Componentes shadcn ya instalados: `table`, `dialog`, `form`, `field`, `skeleton`, `badge` — ninguno nuevo.

## Criterios de aceptación
- [x] AC1 — Dado un producto sin `costCents`, cuando se abre la tabla, entonces `costCents`, `marginCents` y `marginPercent` viajan como `null` y la fila muestra "sin dato".
- [x] AC2 — Dado un producto con `priceCents = 10000` y `costCents = 6000`, entonces `marginCents = 4000` y `marginPercent = 40`.
- [ ] AC3 — Dado un usuario sin `finance.read`, cuando llama `GET /api/admin/finance/unit-price`, entonces responde 403. **No observado con sesión real** (revisión final): solo se probó sin sesión (401 de middleware). El código es idéntico a `requirePermission` de inventario/roles, ya probado en producción, pero falta la confirmación empírica con un usuario logueado sin el permiso.
- [ ] AC4 — Dado un usuario con `finance.read` pero sin `finance.manage_costs`, cuando llama `PATCH .../unit-price/[productId]`, entonces responde 403 y no ve la acción "Editar costo" en la UI. **No observado con sesión real**, mismo motivo que AC3.
- [x] AC5 — Dado un PATCH válido de costo, entonces se escribe `audit_logs` (`finance.cost_updated`, `before`/`after`) en la misma transacción.
- [x] AC6 — Dado un producto con `costCents = 6000`, cuando se crea una sesión de checkout con ese producto, entonces la línea de `order_items` resultante graba `cost_cents_snapshot = 6000` aunque el costo del producto cambie después.
- [x] AC7 — Dado un producto sin `costCents` al momento de la compra, entonces su `order_items.cost_cents_snapshot` queda `NULL` y no se recalcula después aunque más tarde se le cargue un costo.
- [ ] AC8 — Un `employee` (según D4) no puede acceder a `/admin/finance/unit-price` (la página redirige a `/admin`); el nav no oculta la entrada, igual que el resto de secciones del panel (`admin-shell.tsx` D15). **No observado con sesión real**, mismo motivo que AC3.

## Notas
- El campo `PATCH` acepta `costCents: null` a propósito: permite "borrar" un costo cargado por error sin dejarlo en `0` (que se leería como margen 100%).
- Esta fase no crea `src/modules/finance/hooks` de reportes agregados (ingresos, egresos): esos hooks nacen en sus propias fases y comparten el mismo módulo `finance`.

## Notas de implementación (015, cierre)

- El módulo `src/modules/finance/` calca íntegramente la estructura de `src/modules/inventory/`
  (schemas, types, services, hooks, components): mismo patrón de query en URL, mismo patrón
  de mutación con invalidación de TanStack Query, misma separación tabla/diálogo/manager/página.
- `super_admin` y `admin` reciben `finance.read` y `finance.manage_costs` automáticamente vía
  `ALL_PERMISSIONS` en `src/modules/roles/constants.ts`: no hizo falta tocar esas dos entradas
  de `SYSTEM_ROLES`, solo se agregó `PERMISSIONS.FINANCE_READ` a `manager` y `audit`.
- **Hallazgo para las próximas fases (Ingresos, Egresos, Impuestos, Ganancias, Contabilidad):**
  `node --test` (el test runner del proyecto) no resuelve imports de **valor** con alias `@/`
  entre módulos — solo los `import type`, que se eliminan al compilar. Cualquier archivo que
  vaya a correr bajo `node --test` (schemas Zod, `*.math.ts`) debe evitar importar funciones
  de otros módulos vía `@/`, igual que ya hacía `inventory.schema.ts`; si hace falta la misma
  fórmula (p. ej. `toCents`), se reimplementa localmente con un comentario que lo explique.
- Al ejecutar este plan, la base de datos de desarrollo (Neon) no tenía **ninguna** migración
  pendiente aplicada, ni siquiera la 0009 del módulo de inventario (014). Se corrió
  `npm run db:migrate` (confirmado con el usuario antes, por ser una acción sobre infra
  compartida) y quedó al día con 0009 y 0010 juntas.
- La verificación de D2/AC6/AC7 (congelar el costo en el checkout) no usó un checkout real de
  Stripe — requiere navegador — sino un script desechable que ejercitó
  `orderRepository.createWithItems` directo contra la BD real, confirmando que el snapshot se
  graba correcto y no se recalcula después.
- Verificación pendiente del usuario, sin navegador disponible en esta sesión: abrir
  `/admin/finance/unit-price` con una sesión `super_admin`/`admin` (tabla con "Sin dato",
  editar costo, volver a vaciarlo) y con una sesión `employee` (debe redirigir a `/admin`).
  AC3/AC4/AC8 quedan sin marcar hasta esa confirmación (ver más abajo).

### Hallazgos de la revisión final (fresh reviewer, Opus) y su resolución

- **Fuga de datos a clientes (crítico, corregido):** `toOrderListItemDto` (`src/modules/orders/types/index.ts`)
  y `toOrderSummaryDto` (`src/modules/checkout/types/index.ts`) esparcían el `OrderItem` completo,
  así que `cost_cents_snapshot` viajaba a `GET /api/orders` y al resumen de checkout — cualquier
  comprador logueado podía ver el costo de sus propios pedidos. Corregido con un `OrderItemDto`
  explícito (Pick de campos, sin `costCentsSnapshot`) en ambos módulos, con test que fija la
  ausencia del campo en el DTO.
- **Sin tope de costo (importante, corregido):** `updateCostSchema`/`costFormSchema` no tenían
  `.max()` pese a que el spec lo pedía; un costo por encima del rango `int4` de Postgres pasaba
  la validación y reventaba como 500. Se agregó `MAX_COST_CENTS` (99 999 999, $999,999.99).
- **Import de valor `server/ → modules/` (importante, corregido):** `modules/finance/types/finance.ts`
  importaba `computeMargin` desde `@/server/services/finance.math`, violando la regla dura de
  `docs/SETUP.md` §3 ("`server/` solo servidor, nunca se importa desde el cliente") aunque la
  función fuera pura. Se movió `computeMargin` a `src/modules/finance/utils.ts` (mismo patrón que
  `src/modules/orders/utils.ts`); `src/server/services/finance.math.ts` se eliminó.
- **AC3/AC4/AC8 marcados sin verificación empírica (importante, corregido):** se desmarcaron y se
  anotó explícitamente qué falta (sesión real con cada rol).
- **Pendiente, requiere decisión humana (no resuelto en este cierre):** el revisor detectó que
  varios commits de esta fase (`750cf0d`, `74228d9`, `1b403cb`, `c422cad`, `4448d3b`) arrastraron
  cambios del módulo de inventario (014) que ya estaban sin commitear en el árbol de trabajo antes
  de empezar esta fase — el mismo problema que la Task 1 ya había encontrado y corregido para
  `drizzle/`, pero sin generalizarlo a `src/`. Consecuencia: un checkout aislado de este rango de
  commits no compila por sí solo (le faltan piezas de 014 que sus propios commits ya asumen), y
  `drizzle/meta/_journal.json` sigue sin commitear, así que la migración 0010 no corre en ningún
  clon limpio. Ninguna de las dos cosas es un bug de la Fase 1 en sí — el código y los tests de
  esta fase son correctos — pero el estado de `master` no queda listo para otra máquina hasta que
  se resuelva junto con el usuario.

Verificación final tras los fixes: `npm run typecheck && npm run lint && npm run build && npm test` — 173/173.
