# Funciones candidatas a pruebas unitarias

Inventario de funciones del código actual que son **testeables de forma aislada**
(sin UI, sin flujo entre componentes, sin necesidad de levantar Next.js, Clerk,
Stripe o Neon). Sirve de insumo para escribir pruebas con el test runner nativo
de Node (`node --test`), tal como se definió en la conversación sobre
capacidad de unit testing sin dependencias de terceros.

## Criterio de inclusión / exclusión

**Incluido:** funciones puras (mismo input → mismo output, sin efectos
secundarios) y schemas de Zod, que se pueden invocar directo en un test sin
mocks de infraestructura.

**Excluido a propósito**, siguiendo la arquitectura de `docs/SETUP.md`:

- Componentes y hooks de React (`components/`, `hooks/` de cada módulo, `src/hooks/`) — son UI.
- Route Handlers (`src/app/api/**`) y `middleware.ts` — orquestan, no calculan.
- `src/server/repositories/**` — acceso a datos (Drizzle/Neon), es integración, no unit testing.
- La mayoría de `src/server/services/**` y de `src/lib/permissions.ts` / `src/lib/auth.ts` — hacen transacciones de BD, llaman a Stripe o a Clerk; solo se listan los fragmentos puros que quedaron aislados dentro de esos archivos.
- `src/modules/*/services/*.service.ts` — son wrappers delgados de `axios` (una línea por función, sin lógica propia). No hay nada que unit-testear ahí sin mockear la red; se dejan fuera de esta tabla.
- Zustand stores en sí (el estado y las acciones que mutan `set`) — son estado de UI. Solo se listan las funciones puras que conviven en el mismo archivo.

---

## 1. `src/lib` — utilidades transversales

### 1.1 Formato y strings (`src/lib/utils.ts`)

| Función | Descripción |
|---|---|
| `formatPriceFromCents(cents)` | Convierte un precio entero en centavos a texto formateado en locale `es` con 2 decimales (ej. `1999` → `"19.99"`). |
| `toCents(value)` | Convierte un texto de precio (`"19.99"` o `"19,99"`) a centavos enteros, redondeando para evitar el error de punto flotante; devuelve `NaN` si el texto no es numérico. |
| `slugify(value)` | Normaliza un texto a slug `[a-z0-9-]`, quitando tildes/diacríticos y colapsando separadores (`"Audio & Vídeo"` → `"audio-video"`). |
| `cn(...inputs)` | Combina clases de Tailwind con `clsx` + `twMerge`, resolviendo conflictos de utilidades repetidas. |

### 1.2 Errores de API (`src/lib/api-error.ts`)

| Función | Descripción |
|---|---|
| `toErrorResponse(error)` | Traduce cualquier error (`ZodError`, `AppError` o desconocido) a un `NextResponse` JSON con `{ code, message, details }` y el status HTTP correcto. |
| `AppError` y subclases (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`) | Clases de error con `status` y `code` fijos por tipo (400/401/403/404/409); construibles y verificables sin infraestructura. |

### 1.3 Auditoría (`src/lib/audit.ts`)

| Función | Descripción |
|---|---|
| `maskSensitive(value, depth?)` | Recorre un objeto/array recursivamente y reemplaza por `"[REDACTED]"` cualquier valor cuya clave contenga fragmentos sensibles (`password`, `token`, `card`, etc.); corta a profundidad 8. |
| `diffChanges(before, after)` | Compara dos objetos plano-a-plano y devuelve solo las claves que cambiaron (`{ before, after }`), o `null` si no hubo diferencias. |
| `isSecurityAction(action)` | Indica si el nombre de una acción de auditoría (`"role.updated"`, `"auth.login_failed"`, …) pertenece a los prefijos de seguridad que exigen log transaccional y bloqueante. |

### 1.4 Catálogo de permisos (`src/lib/permissions.catalog.ts`)

| Función | Descripción |
|---|---|
| `groupByResource(items)` | Agrupa una lista de objetos con campo `resource` en buckets `{ resource, permissions[] }`, ordenados alfabéticamente por recurso. |

---

## 2. `src/modules/cart` — carrito

### Cálculos del carrito (`src/modules/cart/store/cart-store.ts`)

| Función | Descripción |
|---|---|
| `cartSubtotalCents(items)` | Suma `priceCents * qty` de todas las líneas del carrito y devuelve el subtotal en centavos enteros. |
| `cartItemCount(items)` | Suma las cantidades (`qty`) de todas las líneas para el contador de unidades del carrito. |

---

## 3. `src/modules/orders` — pedidos

### 3.1 Presentación y agrupado (`src/modules/orders/utils.ts`)

| Función | Descripción |
|---|---|
| `groupOrdersByDay(orders)` | Agrupa una lista de pedidos por día calendario **local** del comprador (no UTC), devolviendo grupos con `dayKey`, `label` legible y las órdenes de ese día. |
| `formatOrderTime(createdAt)` | Formatea una fecha ISO a hora local `HH:mm` en locale `es`. |
| `countOrderUnits(order)` | Suma las cantidades (`qty`) de los ítems de un pedido para mostrar el total de unidades compradas. |

### 3.2 Mapeo a DTO (`src/modules/orders/types/index.ts`)

| Función | Descripción |
|---|---|
| `toOrderListItemDto(order)` | Serializa un pedido con sus ítems (fechas `Date` → `string` ISO) al DTO que cruza al cliente. |

### 3.3 Validación — Zod (`src/modules/orders/schemas/order.schema.ts`)

| Schema | Descripción |
|---|---|
| `ordersQuerySchema` | Valida `from`/`to` (ISO datetime opcionales) y `limit` (1–100, default 50) de `GET /api/orders`. |
| `orderFiltersSchema` | Valida el filtro de UI `{ period: "month" \| "custom", from?, to? }` que nunca cruza a la API. |

---

## 4. `src/modules/checkout` — checkout

### 4.1 Mapeo a DTO (`src/modules/checkout/types/index.ts`)

| Función | Descripción |
|---|---|
| `toOrderSummaryDto(order)` | Serializa una orden con ítems (fechas a ISO string) al DTO de resumen post-checkout. |

### 4.2 Validación — Zod (`src/modules/checkout/schemas/checkout.schema.ts`)

| Schema | Descripción |
|---|---|
| `createCheckoutSessionSchema` | Valida el body de `POST /api/checkout/session`: array de `{ productId, qty }` (1 a 50 líneas, qty 1–99), sin aceptar precio del cliente. |

---

## 5. `src/modules/payment-methods` — métodos de pago

### 5.1 Reglas de presentación (`src/modules/payment-methods/constants.ts`)

| Función | Descripción |
|---|---|
| `cardBrandLabel(brand)` | Traduce el código de marca de Stripe (`"amex"`, `"mastercard"`, …) a una etiqueta legible; si la marca no está en el mapa, capitaliza el valor crudo. |
| `formatExpiry(expMonth, expYear)` | Formatea mes/año de vencimiento como `"MM/AAAA"` con el mes siempre a dos dígitos. |
| `isExpired(expMonth, expYear, now?)` | Determina si una tarjeta ya venció, comparando contra el primer día del mes siguiente al de expiración; acepta un `now` inyectable para pruebas deterministas. |

### 5.2 Mapeo a DTO (`src/modules/payment-methods/types/index.ts`)

| Función | Descripción |
|---|---|
| `toPaymentMethodDto(card)` | Proyecta una tarjeta guardada al DTO público, omitiendo `userId` y el id de Stripe, y serializando `createdAt`. |

### 5.3 Validación — Zod (`src/modules/payment-methods/schemas/payment-method.schema.ts`)

| Schema | Descripción |
|---|---|
| `createSetupSessionSchema` | Objeto estricto sin campos: rechaza con 400 cualquier dato enviado en `POST /api/payment-methods/setup-session`. |
| `paymentMethodIdParamSchema` | Valida que el `id` de ruta sea un UUID. |

---

## 6. `src/modules/products` — catálogo

### Validación — Zod (`src/modules/products/schemas/product.schema.ts`)

| Schema | Descripción |
|---|---|
| `createProductSchema` / `updateProductSchema` | Valida alta/edición de producto: nombre, slug (patrón kebab-case), SKU (patrón mayúsculas/números, vacío → `undefined`), precio y stock enteros ≥ 0, URL de imagen absoluta o ruta relativa. |
| `productsQuerySchema` | Valida filtros del listado admin: búsqueda, estado (`all`/`active`/`inactive`), categoría, paginación (1–100). |
| `productFormSchema` | Valida el formulario de UI en formato "humano" (precio y stock como texto), previo a convertir a centavos con `toCents`. |
| `publicProductsQuerySchema` | Valida query pública del catálogo: parsea `categories`/`priceBands` de string coma-separado a array, descarta bandas de precio fuera de `PRICE_BANDS` en vez de rechazar la query. |

> Nota: `commaList` y `emptyToUndefined`, los helpers internos que usan estos
> schemas para transformar strings, son funciones puras pero no están
> exportadas — para testearlas directo habría que exportarlas primero.

---

## 7. `src/modules/categories` — categorías

### Validación — Zod (`src/modules/categories/schemas/category.schema.ts`)

| Schema | Descripción |
|---|---|
| `createCategorySchema` / `updateCategorySchema` | Valida nombre, slug (kebab-case) y descripción de una categoría; `.partial()` conserva el default de `isActive` en `true`. |
| `categoriesQuerySchema` | Valida filtros del listado admin (búsqueda, estado, paginación 1–100). |
| `publicCategoriesQuerySchema` | Valida query pública (sin filtro de estado; el handler fuerza `active`). |

---

## 8. `src/modules/roles` — roles y permisos

### Validación — Zod (`src/modules/roles/schemas/role.schema.ts`, `user-role.schema.ts`)

| Schema | Descripción |
|---|---|
| `createRoleSchema` | Valida slug (patrón `[a-z][a-z0-9_-]*`), nombre y descripción de un rol nuevo. |
| `updateRoleSchema` | Valida edición de nombre/descripción; `slug` e `isSystem` quedan fuera por ser inmutables. |
| `setRolePermissionsSchema` | Valida el array de `permissionIds` (UUIDs, máx. 500) al reemplazar la matriz de un rol. |
| `setUserRolesSchema` | Valida el array de `roleIds` (UUIDs, máx. 20) al asignar roles a un usuario. |
| `usersQuerySchema` | Valida búsqueda y paginación (1–100) del listado de usuarios. |

---

## 9. `src/modules/audit` — bitácora

### Validación — Zod (`src/modules/audit/schemas/audit-log.schema.ts`)

| Schema | Descripción |
|---|---|
| `auditLogsQuerySchema` | Valida los filtros de la bitácora: actor, tipo/id de entidad, acción, severidad, rango de fechas y paginación (1–100). |

---

## 10. `src/server/services` — reglas de negocio de servidor

> El resto de estos archivos (`checkout.service.ts`, `order-fulfillment.service.ts`,
> `product.service.ts`, `category.service.ts`, `role.service.ts`,
> `saved-card.service.ts`, `stripe-customer.service.ts`, `order-receipt.service.ts`)
> mezcla la lógica de negocio con transacciones de Drizzle y llamadas a Stripe en
> la misma función, así que no quedan pure functions unit-testeables sin mockear
> esa infraestructura. Solo un archivo tiene lógica aislada:

### Sincronización de usuarios (`src/server/services/user-sync.service.ts`)

| Función | Descripción |
|---|---|
| `toUserProjection(identity)` | Dado un `ClerkIdentity` normalizado, elige el email primario (o el primero disponible) y arma la proyección `{ clerkId, email, firstName, lastName, imageUrl }`; lanza `BadRequestError` si no hay email utilizable. |

---

## Notas — funciones puras pero privadas (no exportadas)

Estas ya existen y son puras (sin I/O), pero viven como funciones internas de
un archivo con lógica de negocio. Para escribirles una prueba unitaria directa
haría falta exportarlas primero:

| Función | Ubicación | Descripción |
|---|---|---|
| `isUniqueViolation(error)` | `src/server/services/category.service.ts` | Recorre la cadena `cause` de un error de Postgres (hasta profundidad 4) buscando el código `23505` de violación de unicidad. |
| `uniqueViolationTarget(error)` | `src/server/services/product.service.ts` | Igual que la anterior, pero además distingue si el índice violado fue el de `slug` o el de `sku` según el nombre del constraint. |
| `resolvePaymentIntentId(session)` | `src/server/services/order-fulfillment.service.ts` | Extrae el id del PaymentIntent de una sesión de Stripe Checkout, sea que venga como string o como objeto expandido. |
| `toLineItems(order)` | `src/server/services/checkout.service.ts` | Mapea los ítems de una orden ya creada al formato `line_items` que espera Stripe Checkout. |
| `toRequestParams(query)` | `src/modules/products/services/storefront-product.service.ts` | Convierte la query pública de productos a params planos para axios, uniendo arrays (`categories`, `priceBands`) con coma en vez de repetir la clave. |
