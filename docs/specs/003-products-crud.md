---
id: 003
title: Productos del catálogo (CRUD admin)
status: done
module: products
scope: admin
created: 2026-08-31
updated: 2026-08-31
---

# 003 — Productos del catálogo (CRUD admin)

> **Revisión 2 (2026-08-31).** Resueltos los cuatro puntos abiertos: **sin autenticación**
> (Opción B, patrón de la Enmienda 1 de 002) · **`sku` opcional** · **`imageUrl` simple** ·
> **moneda fija**. No queda nada por decidir; el spec solo espera aprobación humana.

## Objetivo
Un administrador puede crear, buscar, filtrar por categoría y estado, editar y eliminar
productos desde `/admin/products`, con paginación y filtrado en servidor y cada mutación
auditada en `audit_logs` dentro de la misma transacción.

## Alcance
Incluye: tabla `products` con FK a `categories` · repositorio, servicio y API admin · módulo
cliente `src/modules/products/` · página con `DataTable` (buscador, filtro por categoría,
filtro por estado, paginación) · extensión de la exención sin auth de 002 a productos ·
guard de borrado de categoría con productos asociados (deuda abierta en 002 §10).

No incluye: **permisos `products.*` ni autenticación** (D1) · galería `product_images` ·
subida de archivos (no hay storage) · API pública `/api/products` ni storefront · variantes,
specs jsonb, descuentos, marcas, `currency` · soft delete (columna `deletedAt` presente pero
sin lógica: `DELETE` sigue siendo físico) · ordenamiento por columna (`DataTable` usa
`tableFeatures({})`) · seed de productos · kardex de stock.

> **Nota post-implementación.** `compareAtPriceCents` y `deletedAt` se agregaron después de
> cerrado este spec, a pedido directo del usuario y fuera del flujo SDD completo (sin spec propio
> ni ciclo developer/reviewer), documentadas aquí para que el modelo de datos no quede desactualizado.

## Datos
Tabla nueva `products` · `src/server/db/schema/product.ts` · **requiere migración**. Modelo final:

| Columna (código) | Columna (BD) | Tipo | Constraint |
|---|---|---|---|
| `id` | `id` | uuid | PK, `defaultRandom()` |
| `name` | `name` | text | NOT NULL · Zod 2–120 |
| `slug` | `slug` | text | NOT NULL · **único** · URL de storefront |
| `sku` | `sku` | text | **NULL** (D2) · único cuando está presente · Zod `^[A-Z0-9][A-Z0-9-]{1,31}$` |
| `description` | `description` | text | NULL · Zod máx. 2000 |
| `categoryId` | `category_id` | uuid | NOT NULL · FK → `categories.id` `ON DELETE RESTRICT` |
| `priceCents` | `price_cents` | integer | NOT NULL · centavos enteros, nunca float (CLAUDE.md §6) |
| `compareAtPriceCents` | `compare_at_price_cents` | integer | NULL · precio de comparación/tachado en centavos, agregado post-implementación (migración `0003_shiny_the_hood.sql`); sin regla que lo obligue a ser mayor que `priceCents` |
| `stock` | `stock` | integer | NOT NULL default `0` · Zod `>= 0` |
| `isActive` | `is_active` | boolean | NOT NULL default `true` |
| `imageUrl` | `image_url` | text | NULL · una sola URL absoluta pegada a mano (D3) |
| `createdAt` | `created_at` | timestamptz | NOT NULL default `now()` |
| `updatedAt` | `updated_at` | timestamptz | NOT NULL default `now()` · refrescado en cada `update` |
| `deletedAt` | `deleted_at` | timestamptz | NULL, sin default. Agregada post-implementación (migración `0004_wet_black_cat.sql`); **sin lógica de soft-delete todavía** — `DELETE` sigue borrando la fila físicamente (`product.repository.ts` → `remove`), la columna queda lista para una futura implementación |

Sin columna `currency`: moneda única implícita (D4). Índices: `products_slug_unique`,
`products_sku_unique`, `products_category_id_idx` (sostiene filtro y guard de borrado),
`products_name_idx` (ordena el listado; no acelera el `ILIKE '%…%'`), declarados con
`uniqueIndex()`/`index()` como en `src/server/db/schema/category.ts:16-19`. `relations()`
añade aquí las dos puntas (`categories 1—N products`), cerrando D12 de 002. Barrel:
`export * from "./product";` en `src/server/db/schema/index.ts`.

## API
Envelope de error y de lista idénticos a 001/002: `{ error: { code, message, details } }` ·
`{ data, meta: { page, pageSize, total } }`.

| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/products` | **sin auth** (D1) | query: `q`, `status`, `categoryId`, `page`, `pageSize` | `{ data: ProductListItemDto[], meta }` |
| POST | `/api/admin/products` | **sin auth** (D1) | `CreateProductInput` | `ProductDto` (201) |
| GET | `/api/admin/products/[id]` | **sin auth** (D1) | — | `ProductDto` |
| PATCH | `/api/admin/products/[id]` | **sin auth** (D1) | `UpdateProductInput` | `ProductDto` |
| DELETE | `/api/admin/products/[id]` | **sin auth** (D1) | — | 204 sin cuerpo |

Errores: 400 `VALIDATION_ERROR`, 404, 409 (`slug`/`sku` duplicado), 500. **Sin 401 ni 403**:
las cinco rutas quedan exentas en `src/middleware.ts` y ningún handler llama `requireAuth()`
ni `requirePermission()`. Las mutaciones toman el actor con `getCurrentUser()`, que puede ser `null`.

Zod en `src/modules/products/schemas/product.schema.ts`: `createProductSchema` (name, slug,
**sku `.optional()`**, description, categoryId `z.uuid()`, priceCents `int().min(0)`, stock
`int().min(0)`, isActive `.default(true)`, imageUrl `.url().nullish()`) · `updateProductSchema`
= `createProductSchema.partial().extend({ isActive: z.boolean().optional() })` (el `.extend` es
obligatorio: `.partial()` no anula el `.default(true)` — verificado en 002 T21) ·
`productsQuerySchema` (q, status enum `all|active|inactive`, categoryId opcional, page, pageSize).

## Decisiones técnicas
Numeración local al spec 003.

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **D1 — Sin autenticación ni autorización en `/admin/products` y `/api/admin/products/*`.** Se replica el patrón exacto de la Enmienda 1 de 002 (§12, D13–D18): route group `(admin-public)`, layout sin `requireAdmin()`, handlers sin `requirePermission()`, actor de `logAudit` nullable. | Opción A de la revisión 1: página bajo `(admin)/admin/` con `requireAdmin()` y `requirePermission(PERMISSIONS.PRODUCTS_*)`, previa configuración de `CLERK_WEBHOOK_SIGNING_SECRET` y seed de un admin. | Decisión explícita del usuario: «en esta etapa no utilizaremos authentication, seran secciones libres». Hoy la Opción A dejaría `/admin/products` inutilizable en local: `.env.local` no tiene el signing secret, el webhook no sincroniza `users` y `seedAdminAssignment` (`seed.ts:98`) no asigna nada sin usuario. **Deuda aceptada temporal**, en violación consciente de CLAUDE.md §4 regla 8, que **debe revertirse antes de cualquier deploy** (plan de cierre al final). Nota: 002 §11 preveía cerrar aquí la deuda de permisos de categorías; este spec la aplaza en vez de cerrarla, y la consolida abajo. |
| **D2 — `sku` nullable y único cuando está presente.** Índice único normal, sin índice parcial ni `NULLS NOT DISTINCT`. | `sku` NOT NULL (propuesta de la revisión 1). | Decisión del usuario. En Postgres el comportamiento por defecto de un índice único es `NULLS DISTINCT`: varios productos sin SKU conviven sin colisionar y dos SKU iguales siguen dando `23505`. `uniqueIndex("products_sku_unique").on(t.sku)` genera exactamente ese índice: **no hay cambio de tipo de índice**. Lo único a blindar es que el formulario no mande `""` (§Notas). |
| **D3 — Una sola `imageUrl` de texto.** | Tabla `product_images` desde ya. | Se mantiene la propuesta original, confirmada. Sin uploader ni storage, una galería sería una tabla vacía con un formulario que nadie puede alimentar. |
| **D4 — Moneda fija, sin columna `currency` ni `compareAtPriceCents`.** | `currency` por producto y/o precio tachado. | Se mantiene la propuesta original, confirmada. `currency` obliga a formatear por fila y a decidir conversiones inexistentes hoy; `compareAtPriceCents` es promociones, un dominio propio. |
| **D5 — `(admin-public)` gana una segunda sección, con layout propio por página**: `(admin-public)/admin/products/layout.tsx`, hermano del de categorías. **No** se hoista un `(admin-public)/admin/layout.tsx` común. | Layout compartido en `(admin-public)/admin/`. | 002 §12.10 advirtió que este grupo puede volverse cajón de sastre y pidió **revisar la decisión** ante una segunda página, no copiarla en automático: esa revisión es este spec y el usuario la aprueba. El layout por página mantiene la exención *opt-in*: una página futura del grupo no queda pública por herencia. Coste: doce líneas duplicadas de un componente que solo renderiza `<AdminShell>`. |
| **D6 — Cuatro entradas exactas nuevas en `isUnauthenticatedRoute`**: `/admin/products`, `/admin/products/(.*)`, `/api/admin/products`, `/api/admin/products/(.*)`. | `"/admin/products(.*)"` sin la barra. | Mismo razonamiento que D16 de 002: el sufijo pegado también casaría con `/admin/products-internos` o `/api/admin/productsX`, abriendo rutas vecinas sin que nadie lo note. `src/middleware.ts:27-32` ya usa la forma con `/` explícito. |

## Reutilizar
Verificado en el repositorio; el developer lo usa **tal cual**, sin recrearlo:
- `src/components/shared/data-table.tsx` — `DataTable`, `createDataTableColumnHelper`, paginación y estados carga/error/vacío.
- `src/components/shared/admin-shell.tsx:4-9` — `NAV_ITEMS`, solo añadir `{ href: "/admin/products", label: "Productos" }`.
- `src/app/(admin-public)/admin/categories/layout.tsx` — **plantilla literal** del layout sin guard (D5).
- `src/middleware.ts:27-32` — `isUnauthenticatedRoute`, se le añaden cuatro entradas (D6).
- `src/server/services/category.service.ts:21,65-66` — `isUniqueViolation` y `actorMetadata(actor)`; el patrón de actor nullable (`actor: User | null`, `actorId: actor?.id ?? null`) se copia igual.
- `src/lib/api-error.ts` (`ConflictError`, `NotFoundError`, `toErrorResponse`) · `src/lib/audit.ts` (`logAudit`, `diffChanges`) · `src/lib/auth.ts` (`getCurrentUser`) · `src/lib/axios.ts` (`api`) · `src/lib/utils.ts:12` (`slugify`) · `src/hooks/use-debounce.ts`.
- `src/server/db/pool.ts` (`dbTx`, `Executor`, `ReadExecutor`) · `src/types/api.ts` (`Serialized<T>`, `Paginated<T>`).
- **Plantillas capa por capa** (mismo patrón, distinto dominio): `src/server/repositories/category.repository.ts`, `src/server/services/category.service.ts`, `src/app/api/admin/categories/route.ts` y `[id]/route.ts`, `src/modules/categories/{schemas,types,services,hooks,components}/*`.
- shadcn: los componentes necesarios ya están instalados (`select`, `dialog`, `alert-dialog`, `checkbox`, `input`, `textarea`, `badge`, `table`, `skeleton`, `field`). **Ningún `npx shadcn@latest add`.**
- `src/modules/products/{components,hooks,schemas,services,types}` ya existen vacías.
- **No se toca**: `src/lib/permissions.catalog.ts`, `src/modules/roles/constants.ts`, `npm run db:seed`, `src/app/(admin)/admin/layout.tsx` ni ninguna ruta del spec 001.

## Criterios de aceptación
- [x] AC1 — En `/admin/products` sin filtros se ven 20 productos por página ordenados por `name` asc, con la **categoría resuelta por nombre** y el precio formateado desde `priceCents`.
- [x] AC2 — El buscador (debounce 300 ms) filtra por `name` **o** `sku` (`ilike`) y vuelve a página 1.
- [x] AC3 — El `Select` de categoría filtra la tabla y se alimenta de `GET /api/admin/categories?status=active&pageSize=100`.
- [x] AC4 — El filtro `Activos`/`Inactivos`/`Todos` filtra por `isActive`.
- [x] AC5 — Copiando la URL con filtros a otra pestaña se reconstruyen filtros, página y tamaño.
- [x] AC6 — Payload válido → 201 y fila en `audit_logs` con `action = 'product.created'`, `entity_type = 'product'`.
- [x] AC7 — `slug` o `sku` ya existente → 409 `CONFLICT` con el mensaje **correcto** (distingue cuál de los dos) en el diálogo, sin insertar en `products` ni en `audit_logs`.
- [x] AC8 — **Dos productos sin `sku`** (campo vacío en el formulario) se crean ambos con 201; ninguno provoca 409 (D2).
- [x] AC9 — `PATCH` que solo cambia `stock` → 200 y `changes` contiene **solo** `stock`; si nada cambia, 200 y **cero** filas nuevas en `audit_logs`.
- [x] AC10 — Borrado confirmado → 204 y fila `product.deleted` con `severity = 'warning'` y el registro anterior en `changes.before`.
- [x] AC11 — `priceCents` negativo, decimal o no numérico, o `stock` negativo → 400 `VALIDATION_ERROR` sin tocar la BD.
- [x] AC12 — `categoryId` uuid inexistente → 400/404 según el guard, sin insertar; la FK nunca produce un 500 opaco.
- [x] AC13 — Borrar una categoría **con productos asociados** → `DELETE /api/admin/categories/[id]` responde 409 `CONFLICT` y la categoría sigue existiendo.
- [x] AC14 — `id` no uuid en cualquier handler `[id]` → 400; uuid inexistente → 404.
- [x] AC15 — **Sin sesión** (navegador anónimo y `curl` sin cookies) se puede listar, crear, editar y borrar en `/admin/products` y `/api/admin/products`: 200/201/204, nunca 401 ni redirección a `/sign-in`.
- [x] AC16 — **La exención no se desborda**: sin sesión, `/admin`, `/admin/roles` y `/admin/audit-logs` siguen redirigiendo a `/sign-in`, `GET /api/admin/roles` sigue en 401 y `GET /api/admin/productsX` responde 401 (D6).
- [x] AC17 — Mutación sin sesión → fila de auditoría con `actor_id = NULL` y `metadata.anonymousActor = true`; la bitácora la muestra como "Sistema" sin romperse.
- [x] AC18 — El formulario captura el precio en unidades (`1299.90`) y envía `priceCents` entero (`129990`); al editar hace la conversión inversa sin pérdida por punto flotante.
- [x] AC19 — `npm run typecheck && npm run lint && npm run build` en verde.

## Tareas
Una capa por tarea, en orden de dependencia. *(Las tareas de la revisión 1 que añadían
`PRODUCTS_*` a `permissions.catalog.ts`, concedían grants a `manager`/`support` y corrían
`db:seed` quedan **eliminadas por D1**: no aplican.)*

- [x] T1 — Tabla `products` con `sku` nullable, sus 4 índices, FK `ON DELETE RESTRICT`, `relations()` y tipos inferidos · `src/server/db/schema/product.ts`
- [x] T2 — Reexportar `product` en el barrel · `src/server/db/schema/index.ts`
- [x] T3 — Generar y aplicar la migración, revisando el SQL antes · `drizzle/` · `npm run db:generate && npm run db:migrate`
- [x] T4 — Helpers puros `formatPriceFromCents(cents: number): string` y `toCents(value: string): number` · `src/lib/utils.ts`
- [x] T5 — Repositorio: `findById`, `findBySlug`, `findBySku`, `listPaginated` (join a `categories` para `categoryName`, filtros `q` sobre `name`/`sku`, `status`, `categoryId`, `count(*)::int`), `create`, `update`, `remove` · `src/server/repositories/product.repository.ts`
- [x] T6 — Añadir `countByCategoryId` · `src/server/repositories/category.repository.ts`
- [x] T7 — Guard: `deleteCategory` lanza `ConflictError` si hay productos asociados (cierra la deuda de 002 §10) · `src/server/services/category.service.ts`
- [x] T8 — Schemas Zod de creación (`sku` opcional), edición y query · `src/modules/products/schemas/product.schema.ts`
- [x] T9 — Servicio de dominio con `actor: User | null`: `createProduct`, `updateProduct`, `deleteProduct` en `dbTx.transaction()` con `logAudit` y `actorMetadata(actor)` en la misma transacción, `diffChanges` en la edición, verificación de que la categoría existe y traducción del `23505` distinguiendo `slug` de `sku` · `src/server/services/product.service.ts`
- [x] T10 — Añadir las cuatro rutas de productos a `isUnauthenticatedRoute`, con la barra explícita (D6) · `src/middleware.ts`
- [x] T11 — Route Handler de colección: `GET` sin auth y `POST` con `const actor = await getCurrentUser()` · `src/app/api/admin/products/route.ts`
- [x] T12 — Route Handler de recurso: `GET`, `PATCH`, `DELETE` con `resolveId()`, sin auth, actor nullable · `src/app/api/admin/products/[id]/route.ts`
- [x] T13 — Tipos `ProductDto`, `ProductListItemDto` (con `categoryName`) y `ProductListResponse` vía `Serialized<T>` · `src/modules/products/types/index.ts`
- [x] T14 — Service axios tipado (`fetchProducts`, `fetchProduct`, `createProduct`, `updateProduct`, `deleteProduct`) · `src/modules/products/services/product.service.ts`
- [x] T15 — `productKeys`, `useProducts(query)` con `keepPreviousData` y `useProductFilters()` sincronizado con la URL · `src/modules/products/hooks/use-products.ts`
- [x] T16 — Mutaciones que invalidan `productKeys.all` · `src/modules/products/hooks/use-product-mutations.ts`
- [x] T17 — Barra de filtros: buscador con debounce 300 ms, `Select` de categoría, `Select` de estado y botón limpiar · `src/modules/products/components/product-filters.tsx`
- [x] T18 — Tabla: columnas nombre+slug, SKU (guion cuando es `null`), categoría, precio, stock, estado (`Badge`) y acciones · `src/modules/products/components/product-table.tsx`
- [x] T19 — Diálogo de alta/edición (RHF + `zodResolver`, slug sugerido desde el nombre solo en creación, SKU opcional que envía `undefined` si queda vacío, precio en unidades, `Select` de categoría, `Checkbox` de estado) · `src/modules/products/components/product-form-dialog.tsx`
- [x] T20 — `AlertDialog` de borrado que muestra el error del servidor dentro del diálogo · `src/modules/products/components/product-delete-dialog.tsx`
- [x] T21 — Contenedor que compone filtros, tabla, paginación y diálogos · `src/modules/products/components/product-manager.tsx`
- [x] T22 — Layout sin guard, copia del de categorías con el comentario adaptado (D5) · `src/app/(admin-public)/admin/products/layout.tsx`
- [x] T23 — Página fina con `metadata`, encabezado en español y `<Suspense>` (el hook de filtros usa `useSearchParams`); borrar el directorio vacío `src/app/(admin)/admin/products/` · `src/app/(admin-public)/admin/products/page.tsx`
- [x] T24 — Añadir `{ href: "/admin/products", label: "Productos" }` a `NAV_ITEMS` · `src/components/shared/admin-shell.tsx`
- [x] T25 — Actualizar el comentario «Este grupo contiene exclusivamente admin/categories», que D5 deja obsoleto · `src/app/(admin-public)/admin/categories/layout.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer).

## Notas
- **`sku` vacío ≠ `sku` nulo.** Si el formulario envía `""`, el índice único ve cadenas vacías repetidas y el segundo producto sin SKU da 409. Zod debe normalizar `""` → `undefined` antes de validar y el repositorio insertar `null`. Es el único riesgo que introduce D2.
- **Precio.** Todo el pipeline viaja en centavos enteros; la única conversión vive en el formulario (T4 + T19). `parseFloat(x) * 100` redondea mal (`19.99 * 100 = 1998.9999…`): usar `Math.round`.
- **Dos claves únicas.** El `23505` puede venir de `slug` o de `sku` e `isUniqueViolation` de 002 solo devuelve booleano: hay que leer `constraint` en la cadena de `cause` o el usuario verá "slug duplicado" cuando el duplicado era el SKU (AC7).
- **Borrado de categoría (T7).** Con `ON DELETE RESTRICT`, sin el guard de servicio el borrado revienta con `23503` y sale como 500; el guard lo convierte en 409 legible.
- **Regresión del guard (T10).** T10 toca el archivo que protege el panel entero: la revisión debe comprobar por diff que `isPublicRoute`, `isAdminRoute` y el cuerpo del `clerkMiddleware` quedan idénticos y solo crecen las cuatro entradas. AC16 lo verifica en runtime.
- **La bitácora de productos pierde el «quién».** Igual que categorías: `getCurrentUser()` devuelve `null` mientras `users` no se sincronice, así que **todas** las mutaciones quedarán con `actor_id = NULL`; AC17 comprueba que quede marcado con `anonymousActor`.
- **Sin storage de imágenes.** Verificado: `package.json` no incluye `@vercel/blob` ni SDK de almacenamiento y no hay ruta de upload; `imageUrl` es una URL pegada a mano (D3). Un uploader es un spec aparte.
- **`ilike` sobre `name`/`sku` hace seq scan.** Irrelevante en este volumen; si crece, `pg_trgm` + GIN.
- **Colisión de nombres.** `src/modules/products/services/product.service.ts` (axios) y `src/server/services/product.service.ts` (dominio) se llaman igual, como ya pasa en categorías. No es un error.
- **Sin tests.** El proyecto sigue sin runner: la verificación es typecheck/lint/build más el repaso manual de los AC.

## Verificación (reviewer)

**Veredicto: APROBADO · iteración 1/2.** Auditoría completa contra spec, `docs/SETUP.md` y
CLAUDE.md §4/§6, con lectura de los 25 archivos tocados por T1–T25 y pruebas en runtime real
contra Neon (no solo trazabilidad de código).

**Mecánico** — `npm run typecheck` ✓ · `npm run lint` ✓ · `npm run build` ✓ (`next build`
genera las 20 rutas esperadas, incluidas `/admin/products` y las 5 de
`/api/admin/products*`). Nota de entorno: correr `build` mientras `next dev` seguía activo en
el puerto 3000 dejó temporalmente en 500 las rutas dinámicas `[id]` de ese servidor de
desarrollo (afecta también a `/api/admin/categories/[id]`, preexistente y no tocado por este
spec) — mismo síntoma que reportó el developer, es un artefacto de Turbopack al compartir
`.next` entre `dev` y `build`, no un defecto de código. Se verificó independientemente
levantando `next start -p 3100` sobre el build recién generado; todos los handlers se probaron
ahí. **Se recomienda reiniciar `npm run dev` en el puerto 3000** tras esta revisión.

**AC1–AC5** (listado, buscador, filtro categoría/estado, URL) — trazados componente → hook →
service → handler → repositorio: `product-table.tsx`/`product-filters.tsx` →
`use-products.ts` (`useProductFilters` sincroniza con `useSearchParams`, debounce 300 ms en
`product-filters.tsx`) → `product.service.ts` (axios) → `route.ts` (`GET`) →
`product.repository.ts` (`listPaginated`, `orderBy(asc(products.name))`, join a `categories`,
`ilike` en `name`/`sku`).

**AC6–AC12, AC14** — verificados en runtime contra Neon (puerto 3100, `next start` limpio):
- `POST` válido → 201; `categoryId` inexistente → **404** `NOT_FOUND` (no 500 opaco, AC12).
- `priceCents` negativo → 400; `priceCents` decimal (`19.99`) → 400 `invalid_type: expected int` (AC11).
- Dos productos sin `sku` → **ambos 201** (AC8).
- `slug` duplicado → 409 `"Ya existe un producto con el slug…"`; `sku` duplicado → 409
  `"Ya existe un producto con el SKU…"` — mensajes distintos confirmados (AC7).
- `PATCH { stock: 50 }` → 200, fila en `audit_logs` con `changes = { before: { stock: 5 },
  after: { stock: 50 } }` (solo ese campo, AC9); segundo `PATCH` con el mismo valor → 200 y
  **cero** filas nuevas en `audit_logs` (confirmado por lectura directa de la tabla).
- `id` no-uuid → 400 `invalid_format`; uuid válido inexistente → 404 (AC14).
- `DELETE` → 204 (AC10).

**AC13** — `DELETE /api/admin/categories/[id]` con productos asociados → 409 `CONFLICT`
(`countByCategoryId` + guard en `deleteCategory`, T6/T7), categoría persiste; tras borrar los
productos, el mismo `DELETE` da 204. Cierra la deuda de 002 §10.

**AC15–AC17** (exención D1/D6) — confirmado con `curl` sin cookies contra el puerto 3100:
- `GET/POST/PATCH/DELETE /api/admin/products*` → 200/201/200/204, nunca 401 (AC15).
- `GET /api/admin/roles` → 401; `GET /api/admin/productsX` → 401 (ruta vecina, no hereda la
  exención); `GET /admin/roles` → 307 a `/sign-in` (AC16). El matcher de `isUnauthenticatedRoute`
  en `src/middleware.ts:28-37` usa las cuatro entradas con `/` explícito, sin desbordarse.
- Fila de auditoría de cada mutación anónima: `actorId: null`, `metadata: { anonymousActor:
  true }` (AC17), leído directamente de `audit_logs` vía Drizzle.

**AC18** (precios) — `toCents`/`formatPriceFromCents` en `src/lib/utils.ts:17-28` usan
`Math.round`; `priceCents` es `z.number().int()` en todo el pipeline (schema Zod, columna
`integer`, `Serialized<T>` no lo convierte a string): nunca viaja como float. `fromCents` en
`product-form-dialog.tsx:61-63` es la inversa exacta, componente-local por tener un solo
consumidor (criterio DRY de CLAUDE.md §6, no viola nada).

**Arquitectura (CLAUDE.md §4/§6)** — sin hallazgos: `ProductListItemDto` solo importa el tipo
`Product` (no repositorio/db); `product.service.ts` de `modules/` usa `api` (axios envuelto),
nunca `fetch`/`axios` crudo; toda consulta vive en `product.repository.ts`/
`category.repository.ts`; los 2 endpoints POST/PATCH validan con Zod antes de tocar datos; cero
`role === 'admin'`, cero `any`/`@ts-ignore` en el módulo; `logAudit` enmascara claves sensibles
y no se ve PII en `changes`/`metadata` de las pruebas realizadas.

**D12 — `categoriesRelations` en `product.ts`** — evaluado como desviación organizativa
aceptable, no un problema: `category.ts` no importa `product.ts` (no hay ciclo real, solo se
evita uno hipotético), y el barrel `schema/index.ts` reexporta ambos sentidos con
`export * from "./product"`, así que el relational query builder de Drizzle ve las dos puntas
igual. Documentado en ambos archivos.

**`security-review`** — el directorio de trabajo no es un repositorio git
(`git status` → `fatal: not a git repository`), así que la skill automática no pudo ejecutarse.
Se cubrió manualmente el foco pedido por el propio spec (D1, D6): el matcher de middleware es
exacto y no se filtra a rutas vecinas (probado arriba), los cinco handlers no llaman
`requirePermission()` de forma deliberada y documentada (comentario idéntico en los 3 archivos
de ruta), el actor nulo se marca con `anonymousActor` en vez de fingir un actor real, no hay SQL
crudo interpolado (todo vía Drizzle parametrizado) y `audit_logs` no registra PII ni secretos.
Sin hallazgos nuevos de seguridad más allá de la deuda D1 ya documentada y aceptada por el
usuario.

**Tareas T1–T25** — las 25 marcadas `[x]` tienen código verificado por lectura directa (no solo
grep de existencia): schema + migración + índices (T1–T3), helpers de precio (T4), repositorio
y guard de categoría (T5–T7), schemas Zod (T8), servicio de dominio transaccional (T9),
middleware (T10), handlers (T11–T12), tipos/service/hooks de cliente (T13–T16), componentes
(T17–T21), layout y página sin auth (T22–T23), nav (T24), comentario de categorías actualizado
(T25).

## Deuda aceptada y plan de cierre
D1 amplía la deuda consolidada de 002 §12.11 de una sección a dos: `/admin/products` y
`/api/admin/products/*` quedan sin **autenticación** y sin **autorización**. Cierre
obligatorio **antes de cualquier deploy**, en este orden: (1) configurar
`CLERK_WEBHOOK_SIGNING_SECRET` y verificar que el webhook sincroniza `users`; (2) sembrar un
usuario con rol admin y permiso `admin.access`; (3) revertir T10, T22, T23 y las llamadas a
`getCurrentUser()` de T11/T12 para devolver productos bajo `(admin)` y el middleware;
(4) añadir `PRODUCTS_READ/CREATE/UPDATE/DELETE` a `src/lib/permissions.catalog.ts`, sembrarlos,
concederlos a los roles y poner `requirePermission()` en los cinco handlers. El orden importa:
reactivar la protección antes de (1) y (2) deja el panel sin nadie que pueda entrar. Mientras
tanto, `security-review` debe ejecutarla el reviewer sobre el diff, con foco en D1 y D6.
