---
id: 011
title: Sesión de Checkout expirada → pedido cancelado visible
status: done
module: orders
scope: client
---

# 011 — Sesión de Checkout expirada → pedido cancelado visible

## Objetivo
Un cliente cuya sesión de Stripe Checkout expiró sin pagarse ve ese pedido como
"Cancelado" en Mis Compras, en vez de "Pendiente" para siempre.

## Alcance
Incluye:
- Evento `checkout.session.expired` en el webhook de Stripe (008).
- Nuevo estado de cobro `expired` + su etiqueta "Cancelado" en historial y `/checkout/success`.
- Script de reconciliación auditado para las órdenes ya expiradas en Neon.
- Suscripción del endpoint de Stripe al nuevo evento.

No incluye:
- Reintentar el pago / regenerar la sesión desde Mis Compras.
- Órdenes `pending_payment` que nunca llegaron a tener sesión (`stripe_checkout_session_id IS NULL`).
- Vista de admin de pedidos.

## Decisión D1 — conflicto con 009 D5 (resuelta)
`canceled` ya tiene un significado tomado: compensación de `checkout.service.ts:138`
cuando Stripe **rechaza crear la sesión**; esas órdenes nunca llegaron a Stripe
(`stripeCheckoutSessionId` queda NULL) y 009 D5/AC6 las oculta por ruido.
Se añade un valor nuevo `expired` en vez de reutilizar `canceled` o filtrar por la
nulabilidad de la sesión (acoplamiento implícito y frágil). Así:
- 009 AC6 sigue literal: ninguna orden `canceled` aparece en el listado.
- `listByUser` no cambia su filtro: `expired` no está excluido, se muestra solo.
- La auditoría distingue `order.canceled` de `order.expired` sin leer metadata.
La etiqueta de cara al cliente sí es "Cancelado" (lenguaje del usuario, no del enum).

## Criterios de aceptación
- [ ] AC1 — Dado un `checkout.session.expired` de una sesión `mode: "payment"` cuya orden está en `pending_payment`, cuando llega al webhook, entonces la orden queda `expired` y se escribe `order.expired` en `audit_logs` dentro de la misma transacción.
- [ ] AC2 — Dado el mismo evento reentregado, cuando se procesa de nuevo, entonces no cambia el estado ni se escribe un segundo registro de auditoría (guard `status = 'pending_payment'` en el UPDATE).
- [ ] AC3 — Dado un `expired` de una orden ya `paid` o `payment_failed`, cuando se procesa, entonces nada cambia y el webhook responde 200.
- [ ] AC4 — Dado un `expired` de una sesión `mode: "setup"` (010), cuando llega, entonces se ignora sin tocar órdenes y responde 200.
- [ ] AC5 — Dado un cliente con una orden `expired` en rango, cuando abre Mis Compras, entonces la ve con badge "Cancelado" (`destructive`); las órdenes `canceled` siguen sin aparecer.
- [ ] AC6 — Dado el script de reconciliación, cuando se ejecuta sobre Neon, entonces `f61b8740-8e36-4a0a-9fdb-4fd778bea5dd` y `4da4f55d-1cc0-494c-9c3c-642fc7faaa80` pasan a `expired` con su registro de auditoría, y una segunda ejecución no modifica ni audita nada.
- [ ] AC7 — El endpoint `we_1UFnGbFgB8mbVDUg2RwlgllL` lista los 4 eventos: los 3 de 008 más `checkout.session.expired`.

## Datos
`order_status` (pgEnum) · nuevo valor `expired` · **requiere migración**
(`ALTER TYPE "order_status" ADD VALUE 'expired'`). Sin cambios de columnas ni de
índices. `orders.status` mantiene su default `pending_payment`.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/webhooks/stripe` | firma `stripe-signature` | raw Stripe event (existente) | `{ received: true }` |
| GET | `/api/orders` | sesión Clerk | — | sin cambios de contrato; `status` puede valer `expired` |

Zod: ninguno nuevo. El webhook valida por `Stripe.webhooks.constructEvent`, no por
Zod (patrón ya establecido en 008); `ordersQuerySchema` no toca `status`.

## Reutilizar
- `src/server/services/order-fulfillment.service.ts` — `findOrderForSession` y el patrón tx + `logAudit` de `markOrderFailed`: copiar su forma, no reinventarla.
- `src/server/repositories/order.repository.ts` — `markFailed` (líneas 173-181) es la plantilla exacta del guard condicional.
- `src/lib/audit.ts` `logAudit` · `src/server/db/pool.ts` `dbTx` — transacción y auditoría.
- `src/modules/orders/constants.ts` `ORDER_STATUS_VIEW` — el badge de `order-card.tsx` ya lo consume; solo falta la entrada.
- `src/app/(storefront)/checkout/success/page.tsx` `STATUS_VIEW` — Record exhaustivo sobre `OrderStatus`: el typecheck exigirá la entrada nueva.
- `src/server/db/sync-clerk-users.ts` — plantilla de script `tsx` (carga de `.env.local`, `closePool()`, resumen por consola).
- `src/lib/stripe.ts` `getStripe()` — cliente del SDK para el script.
Sin componentes shadcn nuevos: el `Badge` ya está instalado.

## Tareas
- [x] T1 — Añadir `"expired"` a `ORDER_STATUSES` · `src/server/db/schema/order.ts`
- [x] T2 — Generar y aplicar la migración del enum · `npm run db:generate && npm run db:migrate` (`drizzle/0007_cynical_lady_vermin.sql`, aplicada)
- [x] T3 — `markExpired(executor, orderId)` con guard `status = 'pending_payment'` · `src/server/repositories/order.repository.ts`
- [x] T4 — `listPendingWithSession(limit)`: órdenes `pending_payment` con `stripeCheckoutSessionId` no nulo · `src/server/repositories/order.repository.ts`
- [x] T5 — `expireOrder(session)`: tx con `markExpired` + `logAudit` `order.expired` (`severity: "warning"`, metadata `{ stripeCheckoutSessionId, reason: "checkout_session_expired" }`) · `src/server/services/order-fulfillment.service.ts`
- [x] T6 — `case "checkout.session.expired"` en el dispatcher, ignorando `mode !== "payment"` · `src/app/api/webhooks/stripe/route.ts`
- [x] T7 — Entrada `expired: { label: "Cancelado", variant: "destructive" }` y actualizar el comentario de D5 · `src/modules/orders/constants.ts`
- [x] T8 — Entrada `expired` en `STATUS_VIEW` ("La sesión de pago expiró", sin cobro) · `src/app/(storefront)/checkout/success/page.tsx`
- [x] T9 — Script de reconciliación: por cada orden de T4, `stripe.checkout.sessions.retrieve`; si `status === "expired"` reusar `expireOrder`/`markExpired` + auditoría con `metadata.source: "backfill"` · `src/server/db/reconcile-expired-orders.ts` + script `db:reconcile-expired` en `package.json` — **ejecutado contra Neon con aprobación del usuario**: 1ª corrida marcó `4da4f55d-1cc0-494c-9c3c-642fc7faaa80` y `f61b8740-8e36-4a0a-9fdb-4fd778bea5dd` como `expired` (2/2, 0 fallidas); 2ª corrida dio `Revisadas: 0 / Marcadas expired: 0`, confirmando idempotencia (AC6 ✓)
- [x] T10 — Suscribir el evento en Stripe (lista completa, el CLI reemplaza) · `stripe webhook_endpoints update we_1UFnGbFgB8mbVDUg2RwlgllL -d "enabled_events[]=checkout.session.completed" -d "enabled_events[]=checkout.session.async_payment_succeeded" -d "enabled_events[]=checkout.session.async_payment_failed" -d "enabled_events[]=checkout.session.expired"` — ejecutado, el endpoint ya lista los 4 eventos (AC7 ✓)

Verificación final: `npm run typecheck && npm run lint`

## Notas
- Postgres no permite **usar** un valor de enum en la misma transacción que lo añade: T9 se ejecuta después de T2 como paso aparte, nunca dentro de la migración.
- T1 rompe a propósito los dos `Record<OrderStatus, …>` exhaustivos (T7, T8): si `typecheck` pasa sin tocarlos, alguno se degradó a `Partial`.
- El backfill de T9 corre contra la BD real: es idempotente por el guard de T3, pero debe listarse su salida (órdenes tocadas) antes de darlo por hecho.
- `expired` no restituye stock: nunca se descontó (solo `fulfillOrder` lo hace).
