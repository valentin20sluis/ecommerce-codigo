---
id: 005
title: Landing page pública + API pública de catálogo (productos y categorías)
status: in-review
module: storefront
scope: public
created: 2026-09-04
updated: 2026-09-04
---

# 005 — Landing page pública + API pública de catálogo

## Objetivo
Un visitante anónimo entra a `/` y ve la home de la tienda: carrusel de ofertas,
categorías, grilla de productos destacados y un carrito local funcional —
implementando el diseño ya aprobado en Claude Design (`Main.dc.html`/`Mobile.dc.html`)
con animaciones (`motion`) y el carrusel del hero (`swiper`). En paralelo queda
disponible la API pública de solo lectura que alimenta esa home y que servirá de base
a la futura página de catálogo con filtros.

## Alcance
Incluye: `GET /api/products` y `GET /api/categories` (solo lectura, solo activos,
sin autenticación) · reescritura de `src/app/(storefront)/page.tsx` como Server
Component que lee del repositorio directo (sin fetch cliente en el primer render) ·
carrusel de ofertas (Swiper) · grilla de categorías y de productos destacados ·
carrito 100% cliente (Zustand + `persist` en `localStorage`, sin backend) · header
del storefront con buscador (input, sin backend de autocompletar), toggle de tema y
carrito · tokens de marca (acento verde lima del diseño aprobado) en `globals.css` ·
instalación de `motion` y `swiper` · seed opcional de catálogo de demostración
reusando las 8 fotos reales ya descargadas y aprobadas en la fase de diseño.

No incluye (próximas fases): página `/products` con filtros en sidebar (diseño
`Products.dc.html`/`ProductsMobile.dc.html` ya aprobado, spec propio) · página de
detalle `/products/[slug]` · carrito persistido en servidor, checkout ni pagos ·
reseñas/calificaciones reales (no existen en el modelo de datos; ver D1) ·
autocompletado de búsqueda con backend · wishlist.

## Datos
Sin tablas nuevas ni migración. Cambios menores, aditivos y retrocompatibles:

- `ListProductsParams` (repositorio) gana `categorySlug?: string`, `sort?: "newest" |
  "price_asc" | "price_desc"` y `onSale?: boolean`, opcionales — el admin sigue
  llamando `listPaginated` sin pasarlos y el comportamiento actual no cambia.
- `ProductListRow` gana `categorySlug: string` (se agrega al `select` del join
  existente; el admin lo recibe y lo ignora).
- `imageUrl` (schema Zod de productos, admin y público) acepta además una ruta
  relativa que empiece en `/` (D2), para poder servir las fotos reales desde
  `public/products/` sin depender de un host externo.

## API
Envelope de error y de lista idénticos a 001/002/003: `{ error: { code, message,
details } }` · `{ data, meta: { page, pageSize, total } }`.

| Método | Ruta | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/api/products` | pública (ya declarada en `middleware.ts`) | `q?`, `category?` (slug), `sort?` (`newest`\|`price_asc`\|`price_desc`, default `newest`), `onSale?` (bool), `page`, `pageSize` (máx. 48, default 12) | `{ data: PublicProductListItemDto[], meta }` |
| GET | `/api/categories` | pública | `q?`, `page`, `pageSize` (máx. 100, default 20) | `{ data: CategoryDto[], meta }` |

Ambas rutas exportan **solo `GET`**: sin `POST`/`PATCH`/`DELETE` (Next responde 405
nativo a otros métodos). Ambas fuerzan `status: "active"` en el repositorio — nunca
aceptan un parámetro `status` del cliente, a diferencia de las rutas admin. Categoría
inexistente en `category` → lista vacía (`data: []`, `total: 0`), nunca 404: es un
filtro, no un recurso.

Zod nuevo en `product.schema.ts`: `PRODUCT_SORT_OPTIONS`, `publicProductsQuerySchema`.
Zod nuevo en `category.schema.ts`: `publicCategoriesQuerySchema`.

Tipos nuevos en `modules/products/types/index.ts`: `PublicProductListItemDto`
(`ProductDto & { categoryName: string; categorySlug: string }`),
`PublicProductListResponse`. `modules/categories/types/index.ts` no cambia:
`CategoryDto`/`CategoryListResponse` ya sirven tal cual.

El home (`page.tsx`) **no** consume estas rutas: lee el repositorio directo desde un
Server Component (regla de `docs/SETUP.md §4`, "lectura inicial, SEO"). La API pública
existe como contrato propio, consumida por servicio/hook `TanStack Query` que quedan
listos para la futura página `/products` con filtros.

## Decisiones técnicas
Numeración local al spec 005.

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **D1 — Sin rating/reviews/badges de marketing fabricados.** El "badge" de cada `product-card` se calcula de datos reales: `stock === 0` → "Agotado"; `compareAtPriceCents` presente → "-N%"; si no, sin badge. Sin estrellas ni contador de reseñas. | Replicar los campos `rating`/`reviews`/`badge` del mock de Claude Design (eran datos de maqueta, no del modelo). | El modelo (`products`) no tiene columnas de reseñas ni existe tabla `reviews`; fabricarlas repetiría el error de "data slop" ya corregido en la fase de diseño (mocks reemplazados por `avgRating`/`totalReviewsLabel` reales). Un sistema de reseñas real es un dominio propio, spec aparte. |
| **D2 — `imageUrl` acepta ruta relativa (`/products/foo.jpg`) además de URL absoluta.** | Mantener solo `z.url()` y subir las fotos a un host externo, o mantener las URLs de Unsplash usadas en el mock. | No hay storage de archivos en el proyecto (confirmado en 003 D3/Notas). Las 8 fotos reales ya están descargadas, verificadas de licencia gratuita y con tamaño optimizado desde la fase de diseño: servirlas desde `public/` evita una dependencia de red externa y un `next.config.ts` con `remotePatterns`. |
| **D3 — Componentes de storefront en una subcarpeta `components/storefront/`** dentro de `modules/products` y `modules/categories`, en vez de mezclarlos con los componentes admin existentes (`product-table.tsx`, etc.) o crear un módulo `modules/storefront/` nuevo. | Módulo `modules/storefront/` propio. | El dominio sigue siendo "productos"/"categorías" (mismos tipos, mismo repositorio); solo cambia la audiencia. Un módulo nuevo duplicaría tipos y schemas que ya existen. La subcarpeta evita colisión de nombres sin fragmentar el dominio. |
| **D4 — Carrito 100% cliente**: Zustand con middleware `persist` (`localStorage`), sin tabla `cart_items` ni endpoint `/api/cart` en esta fase. | Carrito persistido en servidor desde ya (tablas `carts`/`cart_items` ya están en el modelo de `docs/SETUP.md §5.3`). | Fuera del pedido explícito de esta fase ("landing page" + "endpoints de productos y categorías"). Persistir en servidor implica decidir identidad de carrito anónimo, expiración y fusión al iniciar sesión — dominio propio de un spec de checkout. `docs/SETUP.md §4 regla 6` ya clasifica el carrito local como estado de UI → Zustand, consistente con este default. |
| **D5 — Mismo repositorio (`listPaginated`) sirve admin y público**, con `categorySlug`/`sort`/`onSale` opcionales en vez de una función nueva `listPublicPaginated`. | Repositorio público separado. | DRY: la única diferencia es qué combinación de filtros arma cada Route Handler; duplicar la consulta (join, paginación, `count`) por una función que sería casi idéntica viola "se extrae a la tercera repetición" al revés — aquí ya existe una función y basta con extenderla sin romper al llamador actual (admin). |
| **D6 — Acento de marca como tokens nuevos** `--brand`/`--brand-foreground` (y su reflejo `--color-brand`/`--color-brand-foreground` en `@theme inline`), con valores light y dark propios, sin tocar ningún token existente. | Codificar el verde lima directo en clases Tailwind (`bg-[#c6f135]`) dentro de los componentes del hero. | Mantiene el sistema de theming por variables ya usado en todo `globals.css`; un color quemado en componentes no respondería a un futuro cambio de marca ni al modo oscuro. |
| **D7 — Seed de catálogo en un script separado** `src/server/db/seed-catalog.ts` + `npm run db:seed:catalog`, idempotente por `slug`, en vez de extender `seed.ts`. | Agregar productos/categorías dentro de `seed.ts`. | `seed.ts` es específicamente RBAC/usuarios (roles, permisos, `SEED_ADMIN_EMAIL`); mezclar catálogo de demostración ahí le cambia el propósito. Al ser opcional y aparte, no bloquea `npm run db:seed` existente ni sus criterios de aceptación previos. |

## Reutilizar
Verificado en el repositorio; se usa tal cual, sin recrear:
- `src/lib/api-error.ts` (`toErrorResponse`) · `src/lib/axios.ts` (`api`) · `src/types/api.ts`
  (`Paginated`, `Serialized`) · `src/lib/utils.ts` (`formatPriceFromCents`, `cn`).
- `src/server/repositories/product.repository.ts` y `category.repository.ts` — se
  **extienden**, no se reescriben (D5).
- `src/app/api/admin/products/route.ts` y `.../categories/route.ts` — plantilla literal
  de estructura `GET`/`try-catch`/`toErrorResponse`, sin el `POST` ni `getCurrentUser()`.
- `src/middleware.ts` — **sin cambios**: `/`, `/products(.*)`, `/api/products(.*)` y
  `/api/categories(.*)` ya están en `isPublicRoute` desde antes de este spec.
- shadcn ya instalados: `sheet` (drawer de carrito), `button`, `badge`, `input`,
  `skeleton`, `separator`. **Ningún `npx shadcn@latest add`.**
- `src/components/providers/theme-provider.tsx` (ya envuelve la app) · `next-themes`
  ya instalado — el toggle de tema del header solo lo consume.
- `src/app/(storefront)/layout.tsx` y `src/components/shared/header.tsx` — se editan
  in situ, no se crean paralelos.
- Las 8 fotos reales descargadas y verificadas (licencia gratuita, ~17–50 KB c/u) en
  la fase de diseño: `audio-headphones.jpg`, `wearable-watch.jpg`, `keyboard.jpg`,
  `gaming-mouse.jpg`, `smart-speaker.jpg`, `tablet.jpg`, `camera.jpg`, `laptop.jpg`.
- `zustand` ya está en `package.json` (sin uso todavía en el código: este spec es su
  primer consumidor).

## Criterios de aceptación
- [x] AC1 — `GET /api/products` sin parámetros devuelve **solo** `isActive = true`,
  paginado (`pageSize` default 12); un producto inactivo en BD nunca aparece.
- [x] AC2 — `GET /api/products?onSale=true` devuelve solo productos con
  `compareAtPriceCents` no nulo.
- [x] AC3 — `GET /api/products?category=<slug>` filtra exacto por esa categoría;
  slug inexistente → `{ data: [], meta: { total: 0, ... } }`, nunca 404/500.
- [x] AC4 — `sort=price_asc|price_desc|newest` ordena correctamente; sin `sort` el
  default es `newest`.
- [x] AC5 — `GET /api/categories` sin parámetros devuelve solo `isActive = true`.
- [x] AC6 — Ambas rutas exportan solo `GET`; un `POST`/`PATCH`/`DELETE` a
  `/api/products` o `/api/categories` responde 405, nunca ejecuta una mutación.
- [x] AC7 — El HTML servido de `/` (`view-source`, sin JS) ya trae el nombre de al
  menos un producto real: la carga inicial no depende de un `fetch` de cliente a
  `/api/products` ni `/api/categories`.
- [ ] AC8 — El carrusel de ofertas avanza solo, se pausa al pasar el mouse, y las
  flechas prev/next funcionan; si no hay productos con `compareAtPriceCents`, la
  sección de ofertas no se renderiza (sin carrusel vacío). **Sin verificar en
  navegador esta sesión** (ver Verificación).
- [ ] AC9 — "Agregar al carrito" en una `product-card` actualiza en el acto (sin
  recargar) el badge de cantidad del header y el contenido del drawer. **Sin
  verificar en navegador esta sesión.**
- [ ] AC10 — El carrito sobrevive a un refresco de página (`localStorage`) sin
  warning de hidratación en consola. **Sin verificar en navegador esta sesión.**
- [ ] AC11 — Alternar claro/oscuro no rompe contraste ni layout en ninguna sección
  del home (hero, categorías, ofertas, destacados, footer, drawer de carrito).
  **Sin verificar en navegador esta sesión.**
- [ ] AC12 — En viewport < 640px el home es de una columna, sin overflow horizontal.
  **Sin verificar en navegador esta sesión.**
- [x] AC13 — `npm run typecheck && npm run lint && npm run build` en verde.

## Tareas
Una capa por tarea, en orden de dependencia.

- [x] T1 — Instalar `motion` y `swiper` (`npm i motion swiper`)
- [x] T2 — Extender `ListProductsParams`/`listPaginated` (`categorySlug`, `sort`,
  `onSale`) y `ProductListRow` (`categorySlug`) sin romper la firma actual ·
  `src/server/repositories/product.repository.ts`
- [x] T3 — Relajar `imageUrl` para aceptar ruta relativa (D2) ·
  `src/modules/products/schemas/product.schema.ts`
- [x] T4 — `PRODUCT_SORT_OPTIONS` + `publicProductsQuerySchema` ·
  `src/modules/products/schemas/product.schema.ts`
- [x] T5 — `publicCategoriesQuerySchema` ·
  `src/modules/categories/schemas/category.schema.ts`
- [x] T6 — `PublicProductListItemDto`/`PublicProductListResponse` ·
  `src/modules/products/types/index.ts`
- [x] T7 — `GET /api/products` (solo GET, `status: "active"` forzado) ·
  `src/app/api/products/route.ts`
- [x] T8 — `GET /api/categories` (solo GET, `status: "active"` forzado) ·
  `src/app/api/categories/route.ts`
- [x] T9 — Servicio axios + hook público de productos (para la futura página
  `/products`, no consumido por el home) ·
  `src/modules/products/services/storefront-product.service.ts`,
  `src/modules/products/hooks/use-storefront-products.ts`
- [x] T10 — Servicio axios + hook público de categorías ·
  `src/modules/categories/services/storefront-category.service.ts`,
  `src/modules/categories/hooks/use-storefront-categories.ts`
- [x] T11 — Copiar las 8 fotos reales aprobadas a `public/products/*.jpg`
- [x] T12 — Seed opcional de catálogo demo (6 categorías, 8 productos, algunos con
  `compareAtPriceCents`), idempotente por `slug` (D7) ·
  `src/server/db/seed-catalog.ts` + script `db:seed:catalog` en `package.json`
- [x] T13 — Tokens de marca `--brand`/`--brand-foreground` (light y dark) + reflejo
  en `@theme inline` (D6) · `src/app/globals.css`
- [x] T14 — Store de carrito (Zustand + `persist`): `items`, `addItem`, `removeItem`,
  `setQty`, `clear`, `subtotalCents` derivado · `src/modules/cart/store/cart-store.ts`
- [x] T15 — `cart-drawer.tsx` (Sheet: líneas, stepper de cantidad, subtotal, botón de
  checkout deshabilitado "Próximamente") y `cart-trigger-button.tsx` (ícono + badge
  de cantidad) · `src/modules/cart/components/`
- [x] T16 — `product-card.tsx` (imagen real, precio con `formatPriceFromCents`, badge
  D1, botón agregar-al-carrito) y `product-grid.tsx` (skeleton de carga, estado
  vacío) · `src/modules/products/components/storefront/`
- [x] T17 — `hero-carousel.tsx` (Swiper: autoplay 5 s, pausa on-hover, flechas,
  animaciones de entrada con `motion`), recibe los productos en oferta como prop (sin
  fetch propio) · `src/modules/products/components/storefront/`
- [x] T18 — `category-pills.tsx` (chips de categorías; filtra client-side la grilla
  ya cargada por props, sin ir a la URL ni a la API) ·
  `src/modules/products/components/storefront/`
- [x] T19 — Reescribir `src/components/shared/header.tsx`: logo, input de búsqueda
  (sin backend todavía), toggle de tema, `CartTriggerButton`, se conservan los
  botones de auth de Clerk existentes
- [x] T20 — Reescribir `src/app/(storefront)/page.tsx` como Server Component async:
  llama `productRepository.listPaginated` (ofertas y destacados) y
  `categoryRepository.listPaginated` directo (sin pasar por `/api`), compone Hero +
  CategoryPills + secciones "Ofertas" y "Destacados" con transiciones `motion` al
  entrar en viewport
- [x] T21 — `npm run typecheck && npm run lint && npm run build`

## Notas
- **Hidratación del carrito.** `persist` de Zustand lee `localStorage`, inexistente en
  el servidor: el store debe renderizar un estado "no hidratado" (p. ej. badge en 0)
  hasta el primer efecto en cliente, o React marcará mismatch de hidratación (AC10).
- **`sort=newest` depende de `createdAt`.** Con el seed de T12 todos los productos se
  insertan casi al mismo instante; el orden entre ellos es estable pero arbitrario a
  simple vista — no es un bug, es dato de demostración.
- **T12 es la única tarea no bloqueante para las AC de API/UI**: si el usuario prefiere
  cargar productos a mano desde `/admin/products` (ya funcional) en vez de correr el
  seed, T1–T11 y T13–T21 siguen siendo válidas igual; el home solo mostrará "sin
  productos" hasta que haya datos.
- **Sin tests.** El proyecto sigue sin runner (mismo estado que 002/003): verificación
  por `typecheck`/`lint`/`build` más repaso manual de los AC.
- **Post-005: el buscador del header quedó conectado.** T19 lo dejó explícitamente
  sin backend ("input visual"). Con `/products` ya construido (006), se conectó
  fuera de un spec propio: `src/components/shared/header.tsx` ahora envuelve el
  input en un `<form>` con `onSubmit` que navega a `/products?q=<término>`. Se
  evitó a propósito `useSearchParams()` en el header (se usa en todo el layout del
  storefront, incluido el home estático): hubiera forzado un límite de Suspense ahí
  y roto el ISR de `/` (AC7). Por eso el buscador **no** preserva filtros de
  categoría/precio si ya estabas en `/products`: siempre navega "fresco".
- **No es deuda de autenticación.** A diferencia de D1 de 003 (admin sin auth,
  documentado como deuda a cerrar antes de deploy), estas dos rutas son públicas por
  diseño — un catálogo de tienda siempre es de lectura pública. No hay plan de cierre
  porque no hay nada que cerrar.
- **Hallazgo no previsto en el diseño del spec (corregido durante la implementación,
  T20).** `imageUrl` es texto libre del formulario admin desde 003 (D3): un producto
  cargado a mano con una URL externa (probado con un host de Google Imágenes ya
  presente en la BD de desarrollo) hacía que `next/image` respondiera 500
  (`Invalid src prop ... hostname no configurado`) en **cualquier** página que lo
  renderizara, incluida esta landing. Se agregó `product-image.tsx`
  (`src/modules/products/components/storefront/`): usa `next/image` solo para rutas
  locales (`/products/...`) y cae a un `<img>` plano, sin optimizar pero sin poder
  romper la página, para cualquier URL externa. Los tres consumidores
  (`product-card`, `hero-carousel`, `cart-drawer`) se migraron a este componente.
- **ISR agregado fuera del listado original de tareas.** Sin `export const
  revalidate`, Next prerenderiza `/` como estático en el build y nunca vuelve a leer
  Postgres: un cambio de stock o precio en `/admin/products` no se reflejaría hasta
  el próximo deploy. Se fijó `revalidate = 60` en `page.tsx` (confirmado en el output
  de `next build`: `Revalidate 1m`).

## Verificación
Verificación propia en esta sesión (sin agente `reviewer` disponible): `npm run
typecheck`, `npm run lint` y `npm run build` en verde (AC13); `npm run
db:seed:catalog` corrido contra Neon (7 categorías, 8 productos). Con `next dev`
levantado y datos reales sembrados, contra `http://localhost:3000`:

- AC1/AC5 — Ambas rutas fuerzan `status: "active"` en el código (no hay parámetro
  `status` que el cliente pueda enviar); no se creó un producto/categoría inactivo
  para probar el caso negativo en runtime.
- AC2 — `GET /api/products?onSale=true` devolvió exactamente los 4 productos
  sembrados con `compareAtPriceCents` (SonicWave Pro, PulseFit Watch, RapidClick
  Mouse, CaptureX Mirrorless).
- AC3 — `category=accesorios` devolvió exactamente TypeMech Keyboard y RapidClick
  Mouse; `category=no-existe` devolvió `{ data: [], meta: { total: 0 } }`, no 404.
- AC4 — `sort=price_asc` devolvió los precios en orden ascendente (5900, 6900, 8900…).
- AC6 — `POST /api/products` y `POST /api/categories` respondieron **405** (Next
  nativo, sin handler exportado), sin insertar nada.
- AC7 — El HTML de `curl http://localhost:3000/` (sin ejecutar JS) ya contiene
  "CaptureX Mirrorless", "SonicWave Pro" y "Productos destacados": el primer render
  no depende de un fetch de cliente.
- Regresión: `GET /api/admin/products` y `GET /api/admin/categories` (ambas con
  `status=all`) y `GET /admin/products` (HTML) siguen en 200 tras extender
  `listPaginated` (T2) — sin romper el admin existente (003/002).

**AC8–AC12 quedan sin marcar**: son de interacción/visual en navegador (autoplay y
pausa del carrusel, click de "agregar al carrito", persistencia tras refresco sin
warning de hidratación, contraste en dark/light, layout en viewport móvil) y esta
sesión no tiene herramienta de navegador disponible. Quedaron revisados por lectura
de código (el patrón `hasHydrated` evita el mismatch de hidratación descrito en
Notas; las clases responsive están en cada componente), pero no ejecutados. Recomendado
antes de cerrar el spec como `done`: correr `npm run dev` y revisar esos cinco puntos
a simple vista.
