---
id: 008
title: Cobro con Stripe Checkout (pago único, hosted)
status: done
module: orders
scope: client
created: 2026-09-07
---

# 008 — Cobro con Stripe Checkout (pago único, hosted)

> Insumo técnico: `docs/stripe/checkout-integration.md`. Fuera de este spec, ya hechos:
> `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` en `.env.local`/`.env.example`, script
> `stripe:listen` y el `stripe listen` corriendo. El paquete `stripe` **sí** es tarea (T1).
> Usando `stripe:stripe-best-practices` para fijar apiVersion, params y regla de fulfillment.

## Objetivo
Un cliente con sesión de Clerk puede pagar su carrito en Stripe Checkout (modo test) y su
pedido queda persistido y marcado `paid` con el stock descontado por el webhook, no por la
página de éxito.

## Alcance
Incluye: tablas `orders`/`order_items` · `src/lib/stripe.ts` · repositorio de pedidos ·
`checkout.service.ts` (server) · `order-fulfillment.service.ts` · `POST /api/checkout/session` ·
`POST /api/webhooks/stripe` · módulo cliente `src/modules/checkout/` · páginas `/checkout` y
`/checkout/success` · botón real en el carrito.

No incluye: historial/detalle de pedidos del cliente (`(storefront)/orders/`) · gestión de
pedidos y estados de fulfillment (enviado/entregado) en el admin · checkout de invitado ·
Stripe Tax/`automatic_tax` · envío y direcciones · cupones · Payment Element/embebido ·
reembolsos · sincronizar el catálogo con Stripe (`price_data` inline, ver doc §1).

## Decisiones
| # | Decisión | Porqué |
|---|---|---|
| D1 | `CHECKOUT_CURRENCY = "pen"` (soles peruanos) en `src/lib/constants.ts` (archivo nuevo), única en el proyecto; se copia a `orders.currency` por fila. | Mercado objetivo indicado por el usuario: Perú. La unidad menor de PEN son céntimos (2 decimales), igual que `priceCents` entero ya existente — cero conversión. Guardarla por fila deja abierta la multi-moneda sin migrar. |
| D2 | **Se exige sesión de Clerk para pagar.** Sin checkout de invitado. | `orders.userId` es NOT NULL y `middleware.ts:43-53` ya protege `/checkout` y `/api/checkout` sin tocar nada. El invitado obligaría a `userId` nullable + reconciliación por email: spec propio. |
| D3 | `orders.status` = `pending_payment \| paid \| payment_failed \| canceled`, exactos. | Son estados **de cobro**. Los de fulfillment (`shipped`, `delivered`) los añade el spec del admin ampliando el enum, sin renombrar estos. |
| D4 | `stripeCheckoutSessionId` **nullable** con índice único. | La orden nace antes de existir la sesión (su `id` viaja en `metadata`). Se completa en el mismo request; el índice único es `NULLS DISTINCT`, así que varias órdenes recién creadas conviven. |
| D5 | La orden se inserta y **commitea antes** de llamar a Stripe; la sesión se adjunta en una segunda transacción. | Sostener una transacción de Neon abierta durante una llamada HTTP externa bloquea una conexión del pool por segundos. Si Stripe falla, la orden se marca `canceled` y el error se propaga. |

## Datos
Dos tablas nuevas · **requiere migración** (`npm run db:generate && npm run db:migrate`).

`src/server/db/schema/order.ts` — enum `pgEnum("order_status", ...)` (patrón de `auditSeverity`, `audit-log.ts:15`):

| Columna (código) | BD | Tipo | Constraint |
|---|---|---|---|
| `id` | `id` | uuid | PK `defaultRandom()` |
| `userId` | `user_id` | uuid | NOT NULL · FK → `users.id` `ON DELETE RESTRICT` |
| `status` | `status` | `order_status` | NOT NULL default `pending_payment` (D3) |
| `subtotalCents` | `subtotal_cents` | integer | NOT NULL · suma de `order_items` |
| `totalCents` | `total_cents` | integer | NOT NULL · igual a `subtotalCents` en v1 |
| `currency` | `currency` | text | NOT NULL · ISO 4217 minúsculas (D1) |
| `stripeCheckoutSessionId` | `stripe_checkout_session_id` | text | NULL (D4) · **único** · clave de idempotencia |
| `stripePaymentIntentId` | `stripe_payment_intent_id` | text | NULL · se llena al confirmarse el pago |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` | timestamptz | NOT NULL default `now()` |

Índices: `orders_stripe_checkout_session_id_unique`, `orders_user_id_created_at_idx` (`user_id`, `created_at` desc).

`src/server/db/schema/order-item.ts`: `id` uuid PK · `orderId` FK → `orders.id` `ON DELETE CASCADE` ·
`productId` FK → `products.id` `ON DELETE RESTRICT` · `nameSnapshot` text NOT NULL ·
`unitPriceCents` integer NOT NULL (**precio congelado**, nunca se relee) · `qty` integer NOT NULL ·
índice `order_items_order_id_idx`. `relations()` para ambas puntas; barrel en `schema/index.ts`.

## API
Envelope de error de `src/lib/api-error.ts`, idéntico a 001–003.

| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/checkout/session` | `requireAuth()` (Clerk) | `createCheckoutSessionSchema` | `{ url: string }` 200 |
| POST | `/api/webhooks/stripe` | firma Stripe (`constructEvent`) | raw body del evento | `{ received: true }` 200 |

Errores de `/api/checkout/session`: 401 sin sesión · 400 `VALIDATION_ERROR` · 404 `NOT_FOUND`
(productId inexistente o `isActive = false`) · 409 `CONFLICT` (stock insuficiente, con el nombre
del producto) · 500. El webhook responde **400** con firma inválida y 200 en cualquier evento no
manejado; nunca 500 por un evento desconocido (Stripe reintentaría en bucle).

Zod en `src/modules/checkout/schemas/checkout.schema.ts`: `createCheckoutSessionSchema` =
`{ items: array({ productId: z.uuid(), qty: z.number().int().min(1).max(99) }).min(1).max(50) }`.
**El precio nunca viaja en el body**: se relee de `products.priceCents` en el mismo request.

Parámetros de `stripe.checkout.sessions.create` (fijados por la skill, no son estilo):
`mode: "payment"` · `customer_email: user.email` · `line_items` con `price_data`
(`currency: CHECKOUT_CURRENCY`, `unit_amount`, `product_data.name`) · `metadata.orderId` ·
`integration_identifier` (label + sufijo de 8 letras aleatorias, requerido desde `2026-03-25.dahlia`) ·
`success_url = ${NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}` ·
`cancel_url = ${NEXT_PUBLIC_APP_URL}/checkout`. **Sin `payment_method_types`** (métodos dinámicos).
`new Stripe(key, { apiVersion: "2026-07-29.dahlia" })`, instancia única, nunca el patrón global.

## Reutilizar
Verificado en el repositorio; se usa **tal cual**:
- `src/lib/auth.ts:13,20` — `getCurrentUser`, `requireAuth` (devuelve `User` con `email`).
- `src/lib/api-error.ts` — `NotFoundError`, `ConflictError`, `toErrorResponse`.
- `src/lib/audit.ts:115` — `logAudit(executor, entry)`; `src/server/db/pool.ts:20-28` — `dbTx`, `Executor`, `ReadExecutor`.
- `src/app/api/webhooks/clerk/route.ts` — **plantilla literal** del handler de webhook (verificar firma → `dispatch(event)` → `{ received: true }`, `default:` que ignora eventos no suscritos).
- `src/middleware.ts` — **no se toca**: `/api/webhooks(.*)` ya es público (línea 13) y `/checkout` + `/api/checkout` ya exigen sesión por defecto (líneas 43-53). Verificar por diff que sigue idéntico.
- `src/server/repositories/product.repository.ts:60` — `findById`; se le añade `decrementStock` (T9).
- `src/modules/cart/store/cart-store.ts` — `useCartStore`, `cartSubtotalCents`, `hasHydrated`.
- `src/modules/cart/components/cart-drawer.tsx:107-109` — el botón deshabilitado que T22 convierte en link a `/checkout`.
- `src/lib/axios.ts` (`api`, `ApiError`) · `src/lib/utils.ts:19` (`formatPriceFromCents`) · `src/types/api.ts` (`Serialized`) · `src/modules/products/components/storefront/product-image.tsx`.
- `src/modules/products/hooks/use-product-mutations.ts` — patrón de `useMutation` a copiar.
- shadcn: `button`, `card`, `separator`, `badge`, `skeleton`, `sheet` ya instalados. **Ningún `npx shadcn@latest add`.**
- `src/modules/checkout/` **no existe** (sí `cart` y `orders`): se crea con `schemas/`, `services/`, `hooks/`, `components/`, `types/`.

## Criterios de aceptación
- [ ] AC1 — Sin sesión, `GET /checkout` redirige a `/sign-in` y `POST /api/checkout/session` responde 401 (D2).
- [ ] AC2 — `/checkout` con carrito lista líneas, cantidades y subtotal desde `useCartStore`, y con carrito vacío muestra estado vacío con el botón de pago deshabilitado.
- [ ] AC3 — Body válido → 200 `{ url }` de `checkout.stripe.com`, una fila `orders` con `status = 'pending_payment'` y N filas `order_items` con `unitPriceCents` = `products.priceCents` actual.
- [ ] AC4 — Un body con un `priceCents` inyectado no cambia nada: el cobro usa el precio de la BD (Zod ni siquiera acepta el campo).
- [ ] AC5 — `productId` inexistente o inactivo → 404; `qty` > `stock` → 409 con el nombre del producto. En ambos casos, **cero** filas en `orders`/`order_items` y **cero** sesiones creadas en Stripe.
- [ ] AC6 — Pago exitoso con tarjeta de prueba → el webhook deja `status = 'paid'`, `stripePaymentIntentId` poblado, el stock descontado y una fila `audit_logs` `action = 'order.paid'`, `entity_type = 'order'`.
- [ ] AC7 — **Idempotencia**: `stripe events resend <id>` del mismo evento → la orden sigue `paid` y el stock **no** se descuenta dos veces.
- [ ] AC8 — `POST /api/webhooks/stripe` con firma ausente o inválida → 400 y ninguna escritura en BD.
- [ ] AC9 — `checkout.session.async_payment_failed` → `status = 'payment_failed'`, sin descontar stock, con `audit_logs` `severity = 'warning'`.
- [ ] AC10 — `/checkout/success?session_id=...` muestra la orden en solo lectura y **no** cambia ningún estado (verificable: borrar el `status` a mano no lo restaura la página).
- [ ] AC11 — Un `session_id` de **otro** usuario en `/checkout/success` → 404, nunca los datos del pedido ajeno.
- [ ] AC12 — Al ver la orden propia en `/checkout/success`, el carrito de `localStorage` queda vacío; volver a `/checkout` muestra el estado vacío.
- [ ] AC13 — Cancelar en Stripe devuelve a `/checkout` con el carrito intacto; la orden queda `pending_payment` sin stock descontado.
- [ ] AC14 — Ningún `audit_logs.metadata` contiene la clave de Stripe ni datos de tarjeta; `STRIPE_SECRET_KEY` no aparece en respuestas ni en logs.
- [ ] AC15 — `npm run typecheck && npm run lint && npm run build` en verde.

## Tareas
- [x] T1 — Instalar el SDK (`npm i stripe`, 22.x) · `package.json`
- [x] T2 — `CHECKOUT_CURRENCY = "pen"` y el label de `integration_identifier` (D1) · `src/lib/constants.ts` *(nuevo)*
- [x] T3 — Instancia única `new Stripe(...)` con `apiVersion: "2026-07-29.dahlia"` · `src/lib/stripe.ts`
- [x] T4 — Enum `order_status`, tabla `orders`, índices y tipos inferidos · `src/server/db/schema/order.ts`
- [x] T5 — Tabla `order_items` + `relations()` de ambas puntas · `src/server/db/schema/order-item.ts`
- [x] T6 — Reexportar `order` y `order-item` · `src/server/db/schema/index.ts`
- [x] T7 — Generar y aplicar la migración, revisando el SQL antes · `drizzle/`
- [x] T8 — Repositorio: `createWithItems`, `findByStripeSessionId`, `findByIdWithItems`, `attachStripeSession`, `markPaid`, `markFailed`, `markCanceled` · `src/server/repositories/order.repository.ts`
- [x] T9 — `decrementStock(executor, items)` con `sql` sobre `products.stock` · `src/server/repositories/product.repository.ts`
- [x] T10 — Zod `createCheckoutSessionSchema` + tipo inferido · `src/modules/checkout/schemas/checkout.schema.ts`
- [x] T11 — Servicio de cobro: relee productos, valida activo/stock (404/409), inserta orden + items + `logAudit("order.created")` en `dbTx.transaction`, crea la sesión de Stripe, adjunta el `session.id` y marca `canceled` si Stripe falla (D5) · `src/server/services/checkout.service.ts`
- [x] T12 — Fulfillment idempotente: busca por `session.id` (fallback `metadata.orderId`), corta si ya está `paid`, marca pagado, descuenta stock y audita `order.paid`, todo en una transacción; `markOrderFailed` para el fallo · `src/server/services/order-fulfillment.service.ts`
- [x] T13 — Route Handler `POST` con `requireAuth()` + Zod + `toErrorResponse` · `src/app/api/checkout/session/route.ts`
- [x] T14 — Route Handler del webhook: `request.text()` crudo, `constructEvent`, `switch` de los tres eventos con el gate `payment_status !== "unpaid"` · `src/app/api/webhooks/stripe/route.ts`
- [x] T15 — Tipos `CheckoutSessionResponse` y `OrderSummaryDto` (vía `Serialized<T>`) · `src/modules/checkout/types/index.ts`
- [x] T16 — Service axios `createCheckoutSession(input)` sobre `api` · `src/modules/checkout/services/checkout.service.ts`
- [x] T17 — `useCreateCheckoutSession()` (mutation; en `onSuccess` hace `window.location.assign(url)`) · `src/modules/checkout/hooks/use-create-checkout-session.ts`
- [x] T18 — Componente cliente: resumen del carrito, estado vacío, botón "Pagar con Stripe" con `pending` y error del servidor visible · `src/modules/checkout/components/checkout-summary.tsx`
- [x] T19 — Página con `metadata` que solo compone el resumen · `src/app/(storefront)/checkout/page.tsx`
- [x] T20 — Componente cliente que vacía `useCartStore` al montar · `src/modules/checkout/components/clear-cart-on-success.tsx`
- [x] T21 — Página de éxito: Server Component `force-dynamic`, `requireAuth()`, lee por `session_id`, `notFound()` si no es del usuario, render por estado + T20 · `src/app/(storefront)/checkout/success/page.tsx`
- [x] T22 — Reemplazar el botón deshabilitado por un link a `/checkout` deshabilitado solo con carrito vacío · `src/modules/cart/components/cart-drawer.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer).

## Notas
- **Carrera orden ↔ webhook (D4/D5).** Entre el commit de la orden y el `attachStripeSession` hay milisegundos; el pago tarda segundos, así que el webhook prácticamente nunca gana. El fallback por `metadata.orderId` en T12 cubre ese caso residual en vez de dejar una orden pagada sin marcar.
- **Raw body obligatorio.** `constructEvent` valida sobre el string exacto: en T14 se usa `await request.text()` y **no** `request.json()`. Verificado que `middleware.ts` no toca el body.
- **Stock puede quedar negativo.** El descuento ocurre después de cobrar: rechazar ahí sería quedarse con el dinero. Se descuenta sin clamp, así un sobreventa queda visible como stock negativo en el admin en vez de perderse en silencio.
- **`logAudit` no es bloqueante** para acciones que no son de seguridad (`audit.ts:135-138`): un fallo de bitácora no revierte un pago ya cobrado. Correcto aquí, pero significa que AC6 debe verificarse leyendo `audit_logs`, no asumiendo.
- **Pago confirmado, página en `pending_payment`.** Si el webhook aún no llegó, la página de éxito muestra "estamos confirmando tu pago" y recargar la resuelve. No se agrega polling en v1.
- **Precio en `line_items`.** `priceCents` ya es entero en centavos = `unit_amount` de Stripe: cero conversión, cero float (CLAUDE.md §6).
- **Restricted key.** `STRIPE_SECRET_KEY` debe ser `rk_test_...` con Checkout Sessions (write) y Webhook Endpoints (read). Si el usuario pega una `sk_`, funciona igual pero es un hallazgo de seguridad, no un bloqueo técnico.
- **Sin tests.** El proyecto sigue sin runner: AC6–AC9 se verifican en runtime con `npm run stripe:listen`, tarjetas de la skill `stripe:test-cards` y `stripe events resend`.
