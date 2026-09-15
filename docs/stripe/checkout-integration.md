# Integración con Stripe Checkout

> Documento de preparación, no un spec SDD. Antes de implementar, esto debe pasar
> por el flujo normal del proyecto: `orchestrator` → `spec` (con su propia
> aprobación humana) → `developer` → `reviewer`. Este documento es el insumo que
> `spec` puede usar para no partir de cero.

Estado actual del proyecto (verificado en el código, 2026-09-07):

- El catálogo vive en Postgres (`products`, tabla `src/server/db/schema/product.ts`),
  precios en `priceCents` (entero). No existe ningún objeto de Stripe todavía.
- El carrito es **solo de cliente**: Zustand + `localStorage`
  (`src/modules/cart/store/cart-store.ts`). No hay `carts`/`cart_items` en BD.
- `orders` y `order_items` **no existen** en el schema de Drizzle todavía, aunque
  `docs/SETUP.md` §5.3 ya reserva su lugar en la arquitectura.
- Las rutas `(storefront)/checkout` y `(storefront)/orders` existen como carpetas
  vacías: son placeholders, no hay implementación.
- No hay ninguna dependencia de `stripe` en `package.json`.

Es decir: esta integración no reemplaza nada, construye sobre una base limpia.

---

## 1. ¿Conviene sincronizar el catálogo de productos con Stripe?

**No, no para arrancar con Checkout de pagos únicos.** Resumen de la respuesta
dada en el chat, con el detalle técnico:

La API de Checkout Sessions acepta `line_items` de dos formas:

1. **`price`** — el ID de un objeto `Price` preexistente en Stripe. Implica tener
   un `Product`/`Price` en Stripe por cada producto de la tienda, y mantenerlos
   sincronizados cada vez que cambian nombre, imagen o precio en el admin.
2. **`price_data`** — los datos de precio inline, calculados en el momento de
   crear la sesión (`currency`, `unit_amount`, `product_data.name`, etc.), leídos
   directamente de tu propia base de datos.

Con `price_data` **no hace falta sincronizar nada**: Postgres sigue siendo la
única fuente de verdad del catálogo (regla 5 de `CLAUDE.md`: "los tipos se
infieren del schema Drizzle; no se duplican a mano" — el mismo principio aplica
a duplicar el catálogo completo en Stripe). Ventajas concretas para este
proyecto:

- El admin ya tiene CRUD de productos (spec `003-products-crud.md`) con cambios
  de precio, stock y estado inmediatos. Sincronizar implicaría un job o webhook
  saliente hacia Stripe en cada mutación, con su propia lógica de reintentos y
  fallos parciales — complejidad que el alcance actual ("a nivel educado",
  Checkout redirect) no justifica.
- `priceCents` ya es un entero en centavos: es exactamente el formato que espera
  `unit_amount` de Stripe. Cero conversión, cero riesgo de float.
- Evita el problema de "doble fuente de verdad": si algún día un precio en
  Stripe y en Postgres divergen, ¿cuál manda? Con `price_data` la pregunta no
  existe porque Stripe nunca guarda el precio, solo lo usa para esa sesión.

**Cuándo sí conviene sincronizar** (no aplica todavía, pero queda documentado
para no repetir el análisis):

- Si se agregan **suscripciones o planes recurrentes**: la API de Billing exige
  un `Price` real en Stripe (con `recurring`), no admite `price_data` recurrente
  del mismo modo.
- Si se quiere aprovechar reportes o catálogo del lado de Stripe (Payment Links
  sin código, catálogo de producto en el Dashboard, Stripe Tax con
  `tax_code` por producto).
- Si se vende por varios canales que comparten el catálogo de Stripe (POS,
  facturación, marketplace).

Si en el futuro aplica alguno de estos casos, el patrón recomendado es agregar
columnas `stripe_product_id` / `stripe_price_id` (nullable) a `products` y
sincronizar de forma perezosa (al crear/editar en el admin), nunca un import
masivo que se desincroniza solo.

---

## 2. Alcance de esta primera integración

Checkout de **pago único** (no suscripciones), con **Stripe-hosted Checkout**
(redirect), en modo test primero. Es el punto 2 del orden de preferencia de
Stripe (Payment Links → **Checkout** → Payment Element): el mejor punto de
partida para "la mayoría de apps web" según la guía oficial.

Fuera de alcance de este documento (para specs futuros):

- Checkout embebido / Payment Element (UI propia).
- Guardar método de pago (Setup Intents) para compras recurrentes.
- Impuestos automáticos (Stripe Tax) — requiere una registración fiscal activa,
  no se activa "por si acaso".
- Gestión de estados de fulfillment post-pago (enviado, entregado) — es un
  dominio de `orders` en el admin, no de esta integración de cobro.
- Checkout de invitado (sin cuenta). V1 exige sesión de Clerk.

---

## 3. Arquitectura de la integración

```
useCartStore (Zustand)
        │  items[] (productId, qty) — nunca se confía en el precio del cliente
        ▼
modules/checkout/services/checkout.service.ts (axios)
        │  POST /api/checkout/session
        ▼
Route Handler: src/app/api/checkout/session/route.ts
        │  1. requireAuth() (Clerk)
        │  2. Zod: valida shape de items
        │  3. order.repository: relee precio/stock ACTUAL desde products
        │  4. crea `orders` (status: pending_payment) + `order_items` (precio congelado)
        │  5. stripe.checkout.sessions.create({ line_items: price_data..., metadata: { orderId } })
        ▼
Respuesta { url } → redirect del navegador a Stripe (hosted Checkout)
        │
        ▼  (cliente paga en checkout.stripe.com)
        │
        ├─► success_url: /checkout/success?session_id=...  (solo lectura, NO fulfillment)
        │
        └─► Stripe envía evento ─────────────────────────────┐
                                                               ▼
                                     POST /api/webhooks/stripe (firma verificada)
                                                               │
                                     checkout.session.completed /
                                     checkout.session.async_payment_succeeded
                                     (gate: payment_status !== "unpaid")
                                                               │
                                     order-fulfillment.service.ts
                                       - idempotente (busca orden por stripe_checkout_session_id)
                                       - marca `orders.status = "paid"`
                                       - descuenta stock (misma transacción)
                                       - logAudit("order.paid", ...) en la misma tx
```

El punto clave, exigido por la propia guía de Stripe: **el fulfillment ocurre en
el webhook, nunca en la página de éxito**. Un cliente puede pagar y perder la
conexión antes de que cargue `/checkout/success`; si el descuento de stock y el
`status = "paid"` dependieran de esa página, ese pedido se pierde.

---

## 4. Requisitos previos

1. Cuenta de Stripe (modo test). Si no existe cuenta todavía, el plugin de
   Stripe permite generar claves de prueba sin registro:
   ```bash
   npm i -g @stripe/cli
   stripe sandbox create
   ```
   (Si se usa `stripe sandbox create`, no combinar con el MCP de Stripe para
   autenticación en la misma sesión.)
2. Stripe CLI instalado, para reenviar webhooks a `localhost` en desarrollo
   (equivalente a lo que ya hace el proyecto con `clerk webhooks listen`, ver
   `docs/SETUP.md` §7.2).
3. Node.js SDK de Stripe (versión más reciente al momento de instalar,
   `npm install stripe`).

---

## 5. Variables de entorno nuevas

Agregar a `.env.example` y `.env.local` (nunca commitear `.env.local`, regla ya
vigente en el proyecto):

```bash
# Stripe
# Restricted key (rk_test_...), no secret key (sk_...). Permisos mínimos:
# Checkout Sessions (write), Webhook Endpoints (read). Ver §9.
STRIPE_SECRET_KEY="rk_test_..."
# Signing secret del endpoint de webhook (ver §8.3). Sin él, POST /api/webhooks/stripe
# responde 400 — mismo patrón que CLERK_WEBHOOK_SIGNING_SECRET.
STRIPE_WEBHOOK_SECRET="whsec_..."
```

`NEXT_PUBLIC_APP_URL` ya existe en el proyecto — se reutiliza para construir
`success_url` y `cancel_url` de la sesión de Checkout, no hace falta una
variable nueva.

No se necesita `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` en esta v1: al usar Checkout
alojado por Stripe (redirect a `session.url`), no se carga Stripe.js en el
cliente. Esa variable se vuelve necesaria solo si más adelante se migra a
Checkout embebido o Payment Element.

---

## 6. Modelo de datos nuevo

Nuevas tablas, siguiendo la convención `src/server/db/schema/<tabla-singular>.ts`
+ barrel en `index.ts` (ver `docs/SETUP.md` "Convenciones de nombres").

### 6.1 `order.ts`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK | |
| `userId` | uuid, FK → `users.id` | N—1, requerido (sin checkout de invitado en v1) |
| `status` | enum | `pending_payment` \| `paid` \| `payment_failed` \| `canceled` |
| `subtotalCents` | integer | suma de `order_items` en el momento de crear la orden |
| `totalCents` | integer | igual a `subtotalCents` en v1 (sin impuestos ni envío todavía) |
| `currency` | text | ISO 4217 en minúsculas (`"mxn"`, `"usd"`) — definir cuál usa la tienda antes de implementar |
| `stripeCheckoutSessionId` | text, único | clave de idempotencia del webhook |
| `stripePaymentIntentId` | text, nullable | se completa cuando el pago se confirma |
| `createdAt` / `updatedAt` | timestamp | |

`stripeCheckoutSessionId` con constraint `UNIQUE` es lo que hace posible que el
webhook sea idempotente: un `INSERT ... ON CONFLICT DO NOTHING` o un `SELECT`
previo evita procesar el mismo evento dos veces (Stripe puede reenviar eventos).

### 6.2 `order-item.ts`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK | |
| `orderId` | uuid, FK → `orders.id` | |
| `productId` | uuid, FK → `products.id` | |
| `nameSnapshot` | text | nombre del producto al momento de comprar |
| `unitPriceCents` | integer | **precio congelado**, nunca se relee de `products` después de pagado |
| `qty` | integer | |

El precio se congela en `order_items` en el momento de crear la orden (paso 3
del flujo en §3), no después del pago. Es el mismo principio que ya sigue
`docs/SETUP.md` §5.3: *"order_items: detalle con precio congelado"*.

Este documento no define estados de fulfillment (enviado/entregado) ni
dirección de envío — quedan para el spec de gestión de pedidos del admin, que es
un dominio separado del cobro.

---

## 7. Archivos a crear (siguiendo la arquitectura de `docs/SETUP.md`)

```
src/
├── lib/
│   └── stripe.ts                        cliente Stripe único (StripeClient, no global)
├── server/
│   ├── db/schema/
│   │   ├── order.ts
│   │   └── order-item.ts
│   ├── repositories/
│   │   └── order.repository.ts          create, findByStripeSessionId, markPaid, markFailed
│   └── services/
│       ├── checkout.service.ts          arma line_items + crea la orden pendiente + la sesión
│       └── order-fulfillment.service.ts consume el evento del webhook, idempotente
├── modules/
│   └── checkout/
│       ├── schemas/checkout.schema.ts   Zod: shape de items que manda el cliente
│       ├── services/checkout.service.ts axios: POST /api/checkout/session
│       └── hooks/use-create-checkout-session.ts   TanStack Query (mutation)
├── app/
│   ├── api/
│   │   ├── checkout/session/route.ts    POST — crea la sesión, redirige
│   │   └── webhooks/stripe/route.ts     POST — verifica firma, despacha eventos
│   └── (storefront)/
│       ├── checkout/page.tsx            resumen del carrito + botón "Pagar con Stripe"
│       └── checkout/success/page.tsx    lee la orden por session_id, solo lectura
```

`src/lib/stripe.ts` sigue el mismo patrón que ya usa el proyecto para Clerk:
una única instancia, nunca instanciada dentro del handler.

```ts
// src/lib/stripe.ts
import Stripe from "stripe";

// Instancia única del SDK. Nunca usar el patrón global (`Stripe.apiKey = ...`),
// está deprecado en todos los SDKs actuales.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia",
});
```

---

## 8. Flujo paso a paso

### 8.1 Cliente pide crear la sesión

`modules/checkout/services/checkout.service.ts` manda **solo** `productId` y
`qty` por cada línea del carrito — nunca el precio. El precio que viaja en
`useCartStore` es para pintar la UI, no es de fiar para cobrar.

```ts
// modules/checkout/schemas/checkout.schema.ts
import { z } from "zod";

export const createCheckoutSessionSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1),
});
```

### 8.2 Route Handler crea la orden pendiente y la sesión

```ts
// src/app/api/checkout/session/route.ts
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-error";
import { stripe } from "@/lib/stripe";
import { createCheckoutSessionSchema } from "@/modules/checkout/schemas/checkout.schema";
import * as checkoutService from "@/server/services/checkout.service";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { items } = createCheckoutSessionSchema.parse(await request.json());

    // Relee precio y stock reales desde `products`; arma order + order_items
    // + line_items de Stripe en una sola transacción.
    const { checkoutUrl } = await checkoutService.createCheckoutSession(user, items);

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

`checkout.service.ts` (server) es el que decide los `line_items` con
`price_data`, **sin** pasar `payment_method_types` (deja que Stripe elija los
métodos dinámicamente según el Dashboard):

```ts
// src/server/services/checkout.service.ts (fragmento relevante)
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  customer_email: user.email,
  line_items: order.items.map((item) => ({
    quantity: item.qty,
    price_data: {
      currency: CHECKOUT_CURRENCY, // constante única del proyecto, ver §6.1
      unit_amount: item.unitPriceCents,
      product_data: { name: item.nameSnapshot },
    },
  })),
  metadata: { orderId: order.id },
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
});
```

Puntos no negociables (vienen de la guía oficial de Stripe, no son estilo):

- **Nunca** pasar `payment_method_types`. Omitirlo activa selección dinámica de
  métodos de pago administrable desde el Dashboard sin tocar código.
- El precio (`unit_amount`) sale de `order_items.unitPriceCents`, que a su vez
  se congeló leyendo `products.priceCents` en el mismo request — nunca del
  `body` que mandó el cliente.
- Verificar `stock` antes de crear la orden; si algún `productId` no existe, no
  está activo, o no alcanza el stock, se responde 400 sin crear nada en Stripe.

### 8.3 Webhook: verificación y fulfillment

```ts
// src/app/api/webhooks/stripe/route.ts
import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import * as fulfillmentService from "@/server/services/order-fulfillment.service";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text(); // raw body: la verificación de firma lo exige

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      // Métodos con notificación diferida: "completed" puede llegar con la
      // sesión todavía "unpaid". Solo se cumple el pedido si ya está pagada.
      if (session.payment_status !== "unpaid") {
        await fulfillmentService.fulfillOrder(session);
      }
      break;
    }
    case "checkout.session.async_payment_failed": {
      await fulfillmentService.markOrderFailed(event.data.object);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

`fulfillOrder` debe ser **idempotente**: Stripe puede reintentar la entrega del
mismo evento. El patrón:

```ts
// src/server/services/order-fulfillment.service.ts (fragmento)
export async function fulfillOrder(session: Stripe.Checkout.Session) {
  await db.transaction(async (tx) => {
    const order = await orderRepository.findByStripeSessionId(session.id, tx);
    if (!order || order.status === "paid") return; // ya procesado, no repetir

    await orderRepository.markPaid(order.id, session.payment_intent as string, tx);
    await productRepository.decrementStock(order.items, tx);
    await logAudit(tx, {
      actorId: order.userId,
      action: "order.paid",
      entityType: "order",
      entityId: order.id,
      metadata: { stripeCheckoutSessionId: session.id }, // nunca el payment_intent completo ni datos de tarjeta
    });
  });
}
```

Esto respeta la regla 9 de `CLAUDE.md`: `audit_logs` se escribe en la misma
transacción que la mutación auditada, sin secretos ni PII sensible (el
`payment_intent` id no es secreto, pero no se guardan datos de tarjeta — Stripe
nunca los envía al webhook de todas formas).

En el App Router de Next.js, el body de este Route Handler **no debe pasar por
ningún middleware que lo parsee como JSON antes** — se necesita el string crudo
exacto para que `constructEvent` valide la firma. Si `middleware.ts` aplica
alguna transformación de body a rutas de API, excluir explícitamente
`/api/webhooks/stripe`.

### 8.4 Página de éxito (solo lectura)

`/checkout/success?session_id=...` consulta la orden por
`stripeCheckoutSessionId` y muestra su estado — **no** marca nada como pagado
ahí. Si el usuario refresca esa página o nunca llega a cargarla, el pedido ya
quedó resuelto por el webhook.

---

## 9. Seguridad

- **Restricted API Key (`rk_`), no secret key (`sk_`).** Permisos mínimos para
  esta integración: *Checkout Sessions* (write) y *Webhook Endpoints* (read).
  Nunca la clave completa `sk_test_...`/`sk_live_...`.
- La clave vive solo en `STRIPE_SECRET_KEY` del lado servidor. Nunca se expone
  con el prefijo `NEXT_PUBLIC_`, nunca se loguea, nunca aparece en un mensaje de
  error devuelto al cliente.
- `STRIPE_WEBHOOK_SECRET` se trata con el mismo cuidado que una clave secreta.
- Firma del webhook verificada **siempre**, antes de tocar cualquier dato
  (`stripe.webhooks.constructEvent`). Un endpoint de webhook sin verificación de
  firma acepta pedidos falsificados de cualquiera que conozca la URL.
- Claves de test y de producción son distintas variables/entornos — no
  reutilizar la de test en producción "para probar rápido".
- Si en algún momento se agrega un checkout embebido con Stripe.js, sumar
  `https://*.stripe.com` al `Content-Security-Policy` del proyecto
  (`script-src`, `frame-src`, `connect-src`). No aplica a la v1 con redirect
  puro, porque no se carga Stripe.js en el cliente.

---

## 10. Pruebas en desarrollo

1. Levantar el reenvío de eventos con Stripe CLI (mismo patrón que ya usa el
   proyecto con `webhooks:listen` de Clerk en `docs/SETUP.md` §7.2):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   El comando imprime un `whsec_...` de desarrollo — va en `STRIPE_WEBHOOK_SECRET`.
2. Agregar el script equivalente a `package.json`, junto a `webhooks:listen`:
   ```json
   "stripe:listen": "stripe listen --forward-to localhost:3000/api/webhooks/stripe"
   ```
3. Tarjetas de prueba: usar la skill `stripe:test-cards` para la lista vigente
   de números por escenario (pago exitoso, rechazado, requiere autenticación
   3DS, etc.) en vez de memorizarlos.
4. Verificar explícitamente el camino de fallo: una tarjeta que rechaza debe
   dejar la orden en `payment_failed`, sin descontar stock.
5. Verificar idempotencia: reenviar el mismo evento desde el Dashboard de
   Stripe (o `stripe events resend`) y confirmar que el stock no se descuenta
   dos veces.

---

## 11. Checklist antes de pasar esto a un spec

- [ ] Definir `CHECKOUT_CURRENCY` (moneda única de la tienda: `mxn`, `usd`, u
      otra) — no hay ninguna definida todavía en el código.
- [ ] Decidir si v1 exige sesión de Clerk para pagar (recomendado) o si se
      necesita checkout de invitado desde el arranque.
- [ ] Confirmar los valores de `status` de `orders` con lo que espera el futuro
      panel de administración de pedidos (para no migrarlo dos veces).
- [ ] Crear la cuenta/sandbox de Stripe y cargar `STRIPE_SECRET_KEY` /
      `STRIPE_WEBHOOK_SECRET` en `.env.local`.
- [ ] Revisar el checklist oficial de Stripe antes de producción:
      [Go Live Checklist](https://docs.stripe.com/get-started/checklist/go-live.md).

Con esto resuelto, el siguiente paso natural es invocar al agente `spec` (modo
SDD normal del proyecto) para convertir este documento en un spec con tareas
atómicas y criterios de aceptación.
