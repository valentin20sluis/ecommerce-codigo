---
id: 010
title: Mis tarjetas — guardar tarjetas con Stripe en /profile
status: done
module: customers
scope: client
created: 2026-09-09
---

# 010 — Mis tarjetas — guardar tarjetas con Stripe en `/profile`

> Usando `stripe:stripe-docs` (`/payments/save-and-reuse`, variante Checkout Sessions) para fijar el
> flujo: Customer → `mode: "setup"` → `checkout.session.completed` → `setup_intent.payment_method`.
> Continúa 008 (Checkout de compra, sin Customer persistente) y 009 (patrón de tabs en `/profile`).

## Objetivo
Un cliente autenticado guarda una tarjeta en `/profile/tarjetas` mediante la página hosted de Stripe,
la ve listada por marca, últimos 4 dígitos y vencimiento, y la elimina cuando quiera.

## Alcance
Incluye: `users.stripeCustomerId` · tabla `payment_methods` · `POST /api/payment-methods/setup-session`
· confirmación por webhook · `GET /api/payment-methods` · `DELETE /api/payment-methods/[id]` (con
detach) · módulo `src/modules/payment-methods/` · página `/profile/tarjetas` · tab en `profile-nav.tsx`.

No incluye: **marcar predeterminada** (no está en el requerimiento) · pagar el checkout de 008 con una
tarjeta guardada (exige PaymentIntent off-session + 3DS: spec propio) · editar tarjeta · Customer
Portal · métodos que no sean tarjeta · reflejar cambios hechos desde el Dashboard · admin de tarjetas.

## Decisiones
| # | Decisión | Porqué |
|---|---|---|
| D1 | Se guardan **solo** `brand`, `last4`, `expMonth`, `expYear`. Nunca PAN, CVV ni "primeros 4 dígitos". | Stripe no expone el BIN por PCI. `card.brand` ("visa", "amex") ya identifica la empresa, que es lo que el usuario pidió. |
| D2 | El Customer de Stripe va como columna `stripe_customer_id` en `users`, no en tabla aparte. | Es 1—1 con el usuario y no lleva datos propios. Una tabla de una columna es una join sin beneficio. |
| D3 | Se crea **perezosamente**, en el primer `setup-session` del usuario. | No ensucia Stripe con un Customer por cada alta de Clerk, y 008 no lo necesita (usa `customer_email`). |
| D4 | La tarjeta se persiste **solo** desde el webhook `checkout.session.completed` con `mode === "setup"`. El `success_url` no escribe nada. | Mismo criterio de 008: el redirect del navegador es falsificable; el webhook viene firmado. |
| D5 | `DELETE` hace `paymentMethods.detach()` y **borra la fila** (hard delete, sin baja lógica). | No hay historial que preservar: el cobro vive en `orders`. Una fila con `deletedAt` solo invita a listar tarjetas ya desvinculadas. |
| D6 | El webhook inserta con `onConflictDoNothing` sobre `stripe_payment_method_id`. | Stripe reintenta y `stripe events resend` es parte de la verificación: un duplicado sería visible en la UI. |

## Datos
Una columna nueva + una tabla nueva · **requiere migración** (`npm run db:generate && npm run db:migrate`).

`src/server/db/schema/user.ts` — se añade `stripeCustomerId` / `stripe_customer_id` · text · NULL (D3)
· índice **único** `users_stripe_customer_id_unique` (`NULLS DISTINCT`, igual que 008 D4).

`src/server/db/schema/payment-method.ts` — tabla `payment_methods`:

| Columna (código) | BD | Tipo | Constraint |
|---|---|---|---|
| `id` | `id` | uuid | PK `defaultRandom()` |
| `userId` | `user_id` | uuid | NOT NULL · FK → `users.id` `ON DELETE CASCADE` |
| `stripePaymentMethodId` | `stripe_payment_method_id` | text | NOT NULL · **único** (D6) |
| `brand` | `brand` | text | NOT NULL · `card.brand`, minúsculas |
| `last4` | `last4` | text | NOT NULL · 4 dígitos (D1) |
| `expMonth` / `expYear` | `exp_month` / `exp_year` | integer | NOT NULL · 1–12 / año de 4 dígitos |
| `createdAt` | `created_at` | timestamptz | NOT NULL default `now()` |

Índices: el único de arriba + `payment_methods_user_id_created_at_idx`. `relations()` en ambas puntas
y barrel en `schema/index.ts`. `stripeCustomerId` **no** se repite por fila: sale de `users` (D2).

## API
Envelope de `src/lib/api-error.ts`. Las rutas quedan protegidas por `middleware.ts` **sin tocarlo**
(`/api/payment-methods` no está en `isPublicRoute`), más `requireAuth()` en cada handler.

| Método | Ruta | Auth | Body/Param | Response |
|---|---|---|---|---|
| POST | `/api/payment-methods/setup-session` | `requireAuth()` | `createSetupSessionSchema` (vacío, `.strict()`) | `{ url: string }` 200 |
| GET | `/api/payment-methods` | `requireAuth()` | — | `{ data: PaymentMethodDto[] }` 200 |
| DELETE | `/api/payment-methods/[id]` | `requireAuth()` | `id` = `z.uuid()` (param) | `{ success: true }` 200 |
| POST | `/api/webhooks/stripe` | firma Stripe | raw body | `{ received: true }` 200 — ruta **existente**, se amplía |

Errores: 401 sin sesión · 400 `VALIDATION_ERROR` (`id` no-uuid, body con campos de más) · 404
`NOT_FOUND` si la tarjeta no existe **o no es del usuario** (mismo código, para no filtrar existencia,
igual que 009) · 500. El `userId` nunca viaja en query, body ni param: sale de `requireAuth()`.

Zod en `src/modules/payment-methods/schemas/payment-method.schema.ts`: `createSetupSessionSchema` =
`z.object({}).strict()` · `paymentMethodIdParamSchema` = `z.object({ id: z.uuid() })`.

`checkout.sessions.create` (params fijados por la skill): `mode: "setup"` · `customer:
user.stripeCustomerId` · `currency: CHECKOUT_CURRENCY` · `metadata: { userId }` ·
`integration_identifier: CHECKOUT_INTEGRATION_IDENTIFIER` · `success_url =
${NEXT_PUBLIC_APP_URL}/profile/tarjetas?setup=success` · `cancel_url = .../profile/tarjetas`. Sin
`payment_method_types`. En el webhook: `setupIntents.retrieve(session.setup_intent, { expand:
["payment_method"] })` → `payment_method.card.{brand,last4,exp_month,exp_year}`. Al pasar `customer`,
Stripe ya adjunta el PaymentMethod: **no** se llama a `paymentMethods.attach`.

## UI
`/profile/tarjetas` (Server Component con `metadata`, bajo el layout que ya monta `<ProfileNav />`)
compone `<SavedCardList />` (cliente):
- Item `{ href: "/profile/tarjetas", label: "Mis tarjetas" }` en `SECTIONS` de `profile-nav.tsx`.
- Una `Card` por tarjeta: `CreditCardIcon`, `Badge` con la marca capitalizada, `•••• {last4}` y
  `Vence MM/AAAA`. Si está vencida, `Badge` "Vencida" `destructive`, sin bloquear el borrado.
- **Agregar tarjeta**: botón que dispara la mutation y hace `window.location.assign(url)` (patrón de
  `use-create-checkout-session.ts`), con `pending` y el error del servidor visible.
- **Eliminar**: `AlertDialog` con la marca y los `last4` en el texto; al confirmar, mutation + invalidate.
- Con `?setup=success`: banner "Estamos confirmando tu tarjeta" + `invalidateQueries` al montar (D4).
- Estados de carga (`Skeleton`), error y vacío obligatorios.

## Reutilizar
Verificado en el repositorio; se usa **tal cual**:
- `src/lib/auth.ts:20` `requireAuth` · `api-error.ts` `NotFoundError`/`toErrorResponse` ·
  `src/lib/stripe.ts:17` `getStripe()`, **única** vía al SDK · `src/lib/audit.ts:115` `logAudit` ·
  `src/server/db/pool.ts:20-28` `dbTx`, `Executor`, `ReadExecutor`.
- `src/lib/constants.ts` — `CHECKOUT_CURRENCY`, `CHECKOUT_INTEGRATION_IDENTIFIER`.
- `src/app/api/webhooks/stripe/route.ts:7-27` — el `dispatch` existente: solo se le añade el branch por
  `session.mode`; la verificación de firma y el `default:` no se tocan.
- `src/server/services/checkout.service.ts:112-135` — llamada a Stripe fuera de la transacción, a calcar.
- `src/server/repositories/order.repository.ts` — patrón de repositorio con `executor` inyectado.
- `src/modules/checkout/hooks/use-create-checkout-session.ts` — `useMutation` + redirect.
- `src/modules/orders/services/order.service.ts` (axios sobre `api`) · `hooks/use-my-orders.ts`
  (`queryKeys` + `useQuery`) · `components/order-history.tsx` (loading/error/vacío).
- `src/modules/customers/components/profile-nav.tsx:8-12` — `SECTIONS`: se agrega un item, nada más.
- `src/app/(storefront)/profile/favoritos/page.tsx` — plantilla del estado vacío.
- `src/lib/axios.ts` (`api`) · `src/types/api.ts` (`Serialized`) · `src/middleware.ts` — **no se toca**.
- shadcn: `alert-dialog`, `card`, `badge`, `button`, `separator`, `skeleton` ya instalados. **Ningún
  `npx shadcn@latest add`.** Iconos de `lucide-react`, ya instalado.
- `src/modules/payment-methods/` **no existe**: se crea con `schemas/`, `services/`, `hooks/`,
  `components/`, `types/`.

## Criterios de aceptación
- [ ] AC1 — Sin sesión, `/profile/tarjetas` redirige a `/sign-in` y los tres endpoints responden 401.
- [ ] AC2 — El tab "Mis tarjetas" aparece en las cuatro secciones de `/profile` y se marca activo en su ruta.
- [ ] AC3 — Primer "Agregar tarjeta": se crea el Customer, `users.stripe_customer_id` queda poblado y responde 200 con una URL de `checkout.stripe.com`; el segundo **reusa** el mismo Customer (D3).
- [ ] AC4 — Completar el formulario hosted deja **una** fila en `payment_methods` con `brand`, `last4`, `exp_month`, `exp_year`, y un `audit_logs` `action = 'payment_method.saved'`.
- [ ] AC5 — Ninguna columna, respuesta ni `audit_logs.metadata` contiene el número completo, el CVV ni "los primeros 4 dígitos" (D1).
- [ ] AC6 — `stripe events resend <id>` del mismo evento no crea una segunda fila (D6).
- [ ] AC7 — Un `checkout.session.completed` en `mode: "payment"` sigue cumpliendo el pedido de 008 y no toca `payment_methods`; uno en `mode: "setup"` no crea ninguna orden.
- [ ] AC8 — Firma ausente o inválida en `/api/webhooks/stripe` → 400 y ninguna escritura en BD.
- [ ] AC9 — Cancelar en Stripe vuelve a `/profile/tarjetas` sin filas nuevas ni error.
- [ ] AC10 — `GET /api/payment-methods` devuelve **solo** las del usuario de `requireAuth()`, orden `createdAt` desc; sin tarjetas muestra el estado vacío, nunca un spinner infinito.
- [ ] AC11 — `DELETE` propio quita la tarjeta de la lista, la desvincula en Stripe (`payment_method.customer === null`) y audita `payment_method.removed`.
- [ ] AC12 — `DELETE` de una tarjeta **ajena** → 404 (nunca 403 ni datos ajenos); `id` no-uuid → 400; en ambos casos la fila sigue intacta.
- [ ] AC13 — `STRIPE_SECRET_KEY` no aparece en respuestas ni en el bundle; `src/lib/stripe.ts` no se importa desde `src/modules/`.
- [ ] AC14 — `npm run typecheck && npm run lint && npm run build` en verde.

## Tareas
- [x] T1 — Columna `stripeCustomerId` + índice único (D2) · `src/server/db/schema/user.ts`
- [x] T2 — Tabla `payment_methods`, índices, `relations()`, tipos inferidos y barrel · `src/server/db/schema/payment-method.ts` + `schema/index.ts`
- [x] T3 — Generar y aplicar la migración, revisando el SQL antes · `drizzle/`
- [x] T4 — `setStripeCustomerId(executor, userId, customerId)` · `src/server/repositories/user.repository.ts`
- [x] T5 — Repositorio: `listByUser`, `findByIdForUser`, `insertIfAbsent` (`onConflictDoNothing`, D6), `deleteById` · `src/server/repositories/payment-method.repository.ts`
- [x] T6 — Zod `createSetupSessionSchema` y `paymentMethodIdParamSchema` + tipos · `src/modules/payment-methods/schemas/payment-method.schema.ts`
- [x] T7 — `ensureStripeCustomer(user)`: crea el Customer con `email` y `metadata.userId` solo si falta, y lo persiste (D3) · `src/server/services/stripe-customer.service.ts`
- [x] T8 — `createSetupSession(user)`: `ensureStripeCustomer` + `checkout.sessions.create` con los params de §API · `src/server/services/saved-card.service.ts`
- [x] T9 — `saveCardFromSetupSession(session)`: retrieve del SetupIntent con `expand`, corta si el PM no es `card`, `insertIfAbsent` + `logAudit("payment_method.saved")` en una transacción · `src/server/services/saved-card.service.ts`
- [x] T10 — `removeCard(user, id)`: `findByIdForUser` (404), `detach` tolerando el ya-desvinculado, borra la fila + `logAudit("payment_method.removed")` (D5) · `src/server/services/saved-card.service.ts`
- [x] T11 — Route Handler `POST` con `requireAuth()` + Zod + `toErrorResponse` · `src/app/api/payment-methods/setup-session/route.ts`
- [x] T12 — Route Handler `GET` que lista las propias y mapea al DTO · `src/app/api/payment-methods/route.ts`
- [x] T13 — Route Handler `DELETE` con `params` validados por `z.uuid()` · `src/app/api/payment-methods/[id]/route.ts`
- [x] T14 — Branch por `session.mode` en `dispatch` (`"setup"` → T9; `"payment"` → fulfillment de 008) · `src/app/api/webhooks/stripe/route.ts`
- [x] T15 — `PaymentMethodDto` (vía `Serialized<T>`) y `toPaymentMethodDto` · `src/modules/payment-methods/types/index.ts`
- [x] T16 — Services axios `createCardSetupSession`, `fetchMyPaymentMethods`, `deletePaymentMethod(id)` · `src/modules/payment-methods/services/payment-method.service.ts`
- [x] T17 — `paymentMethodKeys` + `useMyPaymentMethods()` · `src/modules/payment-methods/hooks/use-my-payment-methods.ts`
- [x] T18 — `useCreateCardSetupSession()` (redirige en `onSuccess`) y `useDeletePaymentMethod()` (invalida en `onSuccess`) · `src/modules/payment-methods/hooks/use-payment-method-mutations.ts`
- [x] T19 — Etiquetas de marca y helper puro `isExpired(expMonth, expYear)` · `src/modules/payment-methods/constants.ts`
- [x] T20 — `Card` de una tarjeta con marca, `•••• last4`, vencimiento y `AlertDialog` de borrado · `src/modules/payment-methods/components/saved-card-item.tsx`
- [x] T21 — Contenedor cliente: `Skeleton`, error, vacío, banner de `?setup=success` y botón "Agregar tarjeta" · `src/modules/payment-methods/components/saved-card-list.tsx`
- [x] T22 — Página con `metadata` que solo compone la lista · `src/app/(storefront)/profile/tarjetas/page.tsx`
- [x] T23 — Agregar el item "Mis tarjetas" a `SECTIONS` · `src/modules/customers/components/profile-nav.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- **Un `checkout.session.completed`, dos flujos.** El `dispatch` actual (`route.ts:9-18`) manda toda sesión completada a `fulfillOrder`; sin el branch de T14 una sesión de `setup` buscaría una orden inexistente. El gate `payment_status !== "unpaid"` de 008 debe quedar **dentro** del branch `mode === "payment"`: en `setup` no hay pago.
- **`setup_intent` llega como string**, no expandido: T9 hace el `retrieve` con `expand: ["payment_method"]` en vez de asumir el objeto.
- **Ventana entre el redirect y el webhook.** El usuario vuelve antes de que el webhook escriba; sin el banner de `?setup=success` la lista vacía parece un fallo. Sin polling en v1, igual que 008.
- **`detach` de una tarjeta ya desvinculada** devuelve error de Stripe: T10 lo trata como éxito y borra igual la fila local. Dejarla sería mostrar una tarjeta que Stripe ya no tiene.
- **Auditoría sin datos de tarjeta.** `metadata` lleva solo `{ brand }` y `entityId` = id de la fila local (SETUP.md §5.2 regla 3). Ni `last4` ni el `pm_...`.
- **Restricted key.** `STRIPE_SECRET_KEY` necesita ahora Customers (write), SetupIntents (read) y PaymentMethods (write) además de lo de 008. Si falta un permiso, Stripe responde 403 y el endpoint devuelve 500: revisar la key antes de dar por roto el código.
