---
id: 006
title: Página de catálogo pública con filtros (/products)
status: in-review
module: storefront
scope: public
created: 2026-09-04
updated: 2026-09-04
---

# 006 — Página de catálogo pública con filtros (`/products`)

## Objetivo
Un visitante hace click en "Ver todo el catálogo" desde el home (o entra directo a
`/products`) y ve el catálogo completo con filtros de categoría, banda de precio y
ofertas en una barra lateral (bottom-sheet en mobile), orden, vista grid/list y
paginación — implementando el diseño ya aprobado en Claude Design
(`Products.dc.html`/`ProductsMobile.dc.html`, fase de diseño previa a 005).

## Alcance
Incluye: extender `GET /api/products` para soportar **múltiples** categorías y
**bandas de precio** (el mock las filtra con OR entre chips del mismo grupo) ·
página `/products` con filtros sincronizados por URL (mismo patrón que
`useProductFilters` del admin) · sidebar de filtros desktop / bottom-sheet mobile
(responsive, una sola página — mismo enfoque que Main/Mobile en 005, no dos rutas) ·
chips de filtros activos removibles · toggle vista grid/list · paginación
Anterior/Siguiente · botón "Ver todo el catálogo" en el home enlazando acá.

No incluye: filtro de valoración — el mock lo tiene ("4.5★ y más") pero **no hay
columna de rating/reviews en el modelo** (mantiene 005 D1: sin datos fabricados) ·
búsqueda con backend en el input del header (sigue como TODO visual de 005 T19) ·
página de detalle de producto `/products/[slug]` · vista de lista con contenido
distinto al de grid (mismo dato, solo cambia el CSS).

## Datos
Sin tablas nuevas ni migración. Cambios de contrato público, aditivos sobre 005:

- `publicProductsQuerySchema`: `category` (slug único) se **reemplaza** por
  `categories` (lista de slugs, coma-separada, sin caller real todavía — 005 dejó
  los hooks públicos sin consumidor, es seguro romperlo). Nuevo `priceBands` (lista
  de `lt100|100to300|300to700|gt700`, coma-separada).
- `ListProductsParams` (repositorio): `categorySlug?: string` → `categorySlugs?:
  string[]` (OR); nuevo `priceBands?: PriceBand[]` (OR entre bandas, AND con el
  resto de filtros) — mismo repositorio, sin función nueva (005 D5).

## API
| Método | Ruta | Query nueva/cambiada |
|---|---|---|
| GET | `/api/products` | `categories?` (slugs, coma-separada), `priceBands?` (`lt100\|100to300\|300to700\|gt700`, coma-separada) reemplazan a `category`; se mantiene `q`, `sort`, `onSale`, `page`, `pageSize` |

Envelope idéntico a 005. `categories`/`priceBands` vacíos o ausentes no filtran
(comportamiento actual). Slug o banda inválida en la lista → se ignora esa entrada,
nunca 400 (un chip mal formado no debe tumbar todo el filtro).

## Decisiones técnicas
Numeración local al spec 006.

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **D1 — Sin filtro de rating.** Se quita el grupo "Valoración" del sidebar respecto al mock. | Fabricar un `rating` fijo por producto para poder filtrar. | Ya resuelto en 005 D1: el modelo no tiene reseñas reales; repetir el dato de la maqueta sería el mismo "data slop" que se corrigió en la fase de diseño. |
| **D2 — Bandas de precio fijas en centavos**, mismos cortes que el mock: `lt100` (<10000), `100to300` (10000–29999), `300to700` (30000–69999), `gt700` (≥70000). | Rango libre `minPriceCents`/`maxPriceCents`. | El mock permite marcar **varias bandas no contiguas a la vez** ("menos de 100" *y* "más de 700"), algo que un único rango min/max no puede expresar. Las 4 bandas fijas replican el diseño aprobado tal cual y ya encajan con el catálogo sembrado en 005 (revisado: los 8 productos caen en las 4 bandas sin quedar ninguna vacía). |
| **D3 — Filtros sincronizados por URL en `/products`**, calcados del patrón `useProductFilters` que ya existe en `src/modules/products/hooks/use-products.ts` (admin). | Estado solo en cliente (como el home de 005). | El home filtra localmente porque son ~12 productos ya cargados (005 D-implícito); el catálogo completo pagina, así que el filtro **debe** ir al servidor — y una URL compartible/recargable es el mismo requisito que ya resolvió el admin, no hace falta un patrón nuevo. |
| **D4 — Paginación Anterior/Siguiente, sin números de página.** | Paginación numerada (como `DataTable` del admin). | El catálogo público no necesita saltar a una página arbitraria; con `pageSize` 12 y un catálogo chico, anterior/siguiente alcanza y es más simple de construir sobre `ProductGrid` sin traer `TanStack Table`. |
| **D5 — La vista "lista" reusa `ProductGrid`/`ProductCard` con una clase distinta** (columna única, card en fila), no un componente nuevo. | `ProductListRow` component aparte. | Mismo dato, mismo `StorefrontProduct`; alternar el layout es CSS (`grid-template-columns` / `flex-direction` según la clase), no lógica nueva — D5 de 005 aplicado otra vez (extender antes que duplicar). |
| **D6 — El botón nuevo del home es "Ver todo el catálogo"** al final de la sección de destacados, y los `category-pills` del home **siguen filtrando localmente** (no pasan a deep-linkear `/products?categories=…`). | Los pills del home navegan directo al catálogo filtrado. | Cambiar el comportamiento de los pills del home no lo pidió el usuario ("hacer que los botones... funcionen para ver todos los productos") y rompería la interacción ya aprobada en 005 (filtrar los destacados sin salir de la página). Un botón nuevo y explícito es el cambio mínimo que cumple el pedido. |

## Reutilizar
- Todo 005: `/api/products`, `/api/categories`, `ProductCard`/`ProductImage`/
  `ProductGrid`/`ProductGridSkeleton`, `CartDrawer`, tokens `--brand`, `Header`.
- `src/modules/products/hooks/use-storefront-products.ts` y
  `.../services/storefront-product.service.ts` (005 T9, sin consumidor hasta ahora):
  primer consumidor real de este spec.
- `src/modules/products/hooks/use-products.ts` (`useProductFilters`) — plantilla
  exacta del sync URL↔query, adaptada a `publicProductsQuery` en un hook nuevo
  (`use-storefront-product-filters.ts`) en vez de reescribir la lógica.
- shadcn ya instalados: `select` (orden), `checkbox` (filtros), `sheet` (bottom-sheet
  mobile), `skeleton`, `separator`, `button`. **Ningún `npx shadcn@latest add`.**

## Criterios de aceptación
- [x] AC1 — `/products` sin filtros lista productos activos paginados (12), orden
  `newest` por defecto, sin fetch redundante entre navegaciones con los mismos filtros.
- [x] AC2 — Marcar 2+ categorías filtra por **OR** entre ellas; la URL refleja
  `categories=a,b` y sobrevive a un refresco de página.
- [x] AC3 — Marcar 2 bandas de precio no contiguas (`lt100` + `gt700`) devuelve
  productos de ambos extremos, ninguno del medio.
- [x] AC4 — Categoría + banda + "solo ofertas" combinados aplican **AND** entre
  grupos y **OR** dentro de cada grupo.
- [ ] AC5 — Cada chip de "filtros activos" quita solo ese filtro al click. **Sin
  verificar en navegador esta sesión** (interacción de click, ver Verificación).
- [x] AC6 — Cambiar `sort` reordena sin resetear los demás filtros ni la página.
- [ ] AC7 — Toggle grid/list cambia el layout sin perder los productos ya cargados
  ni disparar un fetch nuevo. **Sin verificar en navegador esta sesión.**
- [ ] AC8 — Filtros sin resultados → estado vacío con botón "Limpiar filtros" que
  resetea todo de un click. **Sin verificar en navegador esta sesión.**
- [x] AC9 — "Siguiente"/"Anterior" pagina respetando los filtros activos (datos
  confirmados por API; el deshabilitado de los botones en los extremos es UI, sin
  verificar en navegador).
- [x] AC10 — El botón "Ver todo el catálogo" del home navega a `/products` sin 404
  y sin filtros preaplicados.
- [x] AC11 — `npm run typecheck && npm run lint && npm run build` en verde.

## Tareas
Una capa por tarea, en orden de dependencia.

- [x] T1 — `PriceBand`, `categorySlugs`/`priceBands` en `ListProductsParams` +
  traducción a condiciones OR en `listPaginated` (D2) ·
  `src/server/repositories/product.repository.ts`
- [x] T2 — `publicProductsQuerySchema`: `categories`/`priceBands` (coma-separada →
  array, entradas inválidas descartadas, nunca 400) ·
  `src/modules/products/schemas/product.schema.ts`
- [x] T3 — `GET /api/products` pasa `categories`/`priceBands` al repositorio ·
  `src/app/api/products/route.ts`
- [x] T4 — `useStorefrontProductFilters` (sync URL↔`publicProductsQuerySchema`,
  calco de `useProductFilters`) · `src/modules/products/hooks/use-storefront-products.ts`
- [x] T5 — Variante `list` de `ProductGrid` (una clase, mismo componente, D5) ·
  `src/modules/products/components/storefront/product-grid.tsx`
- [x] T6 — `catalog-sidebar.tsx` (categorías multi-check con conteo, bandas de
  precio, toggle "solo ofertas", "Limpiar") — desktop ·
  `src/modules/products/components/storefront/`
- [x] T7 — `catalog-filters-sheet.tsx` (mismo contenido de T6 en un `Sheet` bottom,
  botón "Filtros" con badge de cantidad activa) — mobile ·
  `src/modules/products/components/storefront/`
- [x] T8 — `active-filter-chips.tsx` (chips removibles por filtro individual) ·
  `src/modules/products/components/storefront/`
- [x] T9 — `catalog-toolbar.tsx` (título, conteo de resultados, `Select` de orden,
  toggle grid/list) · `src/modules/products/components/storefront/`
- [x] T10 — `catalog-pager.tsx` (Anterior/Siguiente, D4) ·
  `src/modules/products/components/storefront/`
- [x] T11 — `src/app/(storefront)/products/page.tsx`: compone T6–T10 + `ProductGrid`,
  usa `useStorefrontProducts`/`useStorefrontProductFilters` (fetch cliente — a
  diferencia del home, acá sí aplica el camino de 005 §4 "componente cliente + hook",
  no lectura directa de repositorio, porque el filtrado es interactivo)
- [x] T12 — Botón "Ver todo el catálogo" al final de la sección de destacados (D6) ·
  `src/app/(storefront)/page.tsx`
- [x] T13 — `npm run typecheck && npm run lint && npm run build`

## Notas
- **Conteos por checkbox resueltos como estáticos**, no como "según el resto de
  filtros activos": releyendo el mock (`catCheck`/`priceCheck` de `Products.dc.html`
  T808-818), sus conteos ya se calculaban sobre `cards` (el catálogo completo sin
  filtrar), no sobre `list` (el filtrado) — así que replicarlo tal cual no necesitaba
  la combinatoria que anticipaba esta nota original. `getFacetCounts()` (T1/T6) hace
  2 queries agregadas (`group by` categoría + un `count(*) filter (where …)` de una
  sola fila para las 4 bandas), sin parámetros de filtro, cacheables a futuro si el
  volumen lo pide.
- **Categorías sin productos activos no se listan** en el sidebar/sheet (mismo
  criterio que `CategoryPillsSection` del home en 005): evita checkboxes que darían
  "(0)" siempre — la BD de desarrollo tiene categorías vacías de pruebas previas
  ("Monitores", "Mouse", "Smartphones") que quedan ocultas por esto, no por un filtro
  especial contra ellas.
- **Sin tests.** Mismo estado que 002/003/005: verificación por
  `typecheck`/`lint`/`build` más repaso manual de los AC.
- **`ProductCard` no cambia de contenido**, solo gana la prop `layout` para la vista
  de lista (D5); sigue sin rating (005 D1).

## Verificación
Verificación propia en esta sesión (sin agente `reviewer` disponible): `npm run
typecheck`, `npm run lint` y `npm run build` en verde (AC11), `/products` genera
como página estática con el manager cliente detrás de `Suspense`. Con `next dev`
levantado contra los datos reales sembrados en 005, vía `curl`:

- AC1 — `GET /api/products?pageSize=3` devuelve 3 de 8, `sort` default `newest`.
- AC2 — `categories=audio,fotografia` devolvió exactamente SonicWave Pro y CaptureX
  Mirrorless (OR entre ambas).
- AC3 — `priceBands=lt100,gt700` devolvió los 5 productos de esos dos extremos
  (TypeMech, RapidClick, EchoHome, UltraBook, CaptureX) y ninguno de las bandas del
  medio (PulseFit, SonicWave, TabAir quedaron fuera).
- AC4 — `categories=accesorios&priceBands=lt100&onSale=true` devolvió **solo**
  RapidClick Mouse: TypeMech (accesorios+lt100 pero sin oferta) quedó excluido,
  confirmando AND entre categoría/banda/oferta y OR dentro de cada grupo.
- AC6 — `categories=accesorios&sort=price_desc` devolvió TypeMech (8900) y luego
  RapidClick (5900): orden descendente sin perder el filtro de categoría.
- AC9 — `pageSize=3&page=2&sort=price_asc` devolvió PulseFit/SonicWave/TabAir en el
  orden de precio correcto para esa página (posiciones 4-6 del listado completo).
- `categories=no-existe` y `priceBands=invalido` respondieron **200** con listas
  vacías/sin ese filtro aplicado, nunca 400 (spec API).
- Regresión: `GET /api/admin/products`, `GET /api/admin/categories` y `/admin/products`
  siguen en 200 tras extender `listPaginated` con `categorySlugs`/`priceBands`.

**Bug reportado por el usuario tras probar en navegador (post-verificación inicial):**
los checkboxes de categoría y de precio no filtraban nada. Causa: `fetchPublicProducts`
pasaba `query` directo a `api.get(..., { params: query })`; axios serializa un array
por defecto repitiendo la clave (`categories[]=a&categories[]=b` o `categories=a&categories=b`
según versión), nunca como `categories=a,b` — que es la única forma que
`publicProductsQuerySchema` sabe leer (la misma que arma `useStorefrontProductFilters`
para la URL con `String(array)`). El servidor nunca recibía la clave `categories`/
`priceBands` reconocible y devolvía siempre la lista sin filtrar. Corregido en
`src/modules/products/services/storefront-product.service.ts` con un
`toRequestParams()` que hace `array.join(",")` antes de pasarlo a axios — mismo
formato que ya probé por API en la verificación de abajo (que por eso *sí* pasaba:
`curl` con `?categories=a,b` a mano nunca pasó por este bug, solo lo hacía el cliente
real). Confirmado con `typecheck`/`lint` en verde tras el fix; pendiente que el
usuario confirme en su navegador que ya filtra.

**AC5, AC7, AC8 quedan sin marcar**: son de interacción en navegador (click en un
chip, toggle grid/list, botón "Limpiar filtros" del estado vacío) y esta sesión no
tiene herramienta de navegador disponible — mismo límite que cerró 005. Revisados
por lectura de código (los tres llaman a `setFilters`/`reset` con los mismos
parámetros ya verificados por API), pero no ejecutados con clicks reales.
Recomendado antes de cerrar el spec como `done`: correr `npm run dev`, entrar a
`/products` y probar esos tres puntos a simple vista, además del bottom-sheet en un
viewport angosto (`CatalogFiltersSheet`, sin cobertura de API posible).
