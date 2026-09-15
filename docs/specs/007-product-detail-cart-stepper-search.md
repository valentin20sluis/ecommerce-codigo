---
id: 007
title: Detalle de producto, stepper de cantidad en el carrito y buscador con resultados
status: in-review
module: storefront
scope: public
created: 2026-09-04
updated: 2026-09-04
---

# 007 — Detalle de producto, stepper de cantidad y buscador con resultados

## Objetivo
Un visitante entra al detalle de un producto (`/products/[slug]`) desde cualquier
card o desde un resultado del buscador; desde ahí y desde cualquier grilla puede
ajustar la cantidad en el carrito con un stepper en vez de un botón "+" ciego; y el
buscador del header muestra resultados reales mientras escribe, sin agregar nada al
carrito al hacer click.

## Alcance
Incluye: página `/products/[slug]` (Server Component, lee el repositorio directo,
`notFound()` si no existe o está inactivo) · `AddToCartControl` compartido: botón
"+" cuando la cantidad en el carrito es 0, stepper `- N +` cuando es > 0, usado por
`ProductCard` y por el detalle · imagen y nombre de `ProductCard` se vuelven enlace
a la ficha del producto, sin que el click en el stepper dispare la navegación (ni al
revés) · dropdown de resultados en el buscador del header (debounced, top 5,
`GET /api/products?q=`), cada fila enlaza directo a `/products/[slug]` · el submit
del formulario (Enter, sin haber clickeado una fila) sigue yendo al catálogo con
`q=` (ya construido, sin cambios).

No incluye: productos relacionados/"también te puede interesar" en el detalle ·
galería de varias imágenes (el modelo solo tiene `imageUrl` único, 003 D3) ·
reseñas/rating (005 D1, se mantiene) · endpoint público `GET /api/products/[slug]`
(el detalle lee el repositorio directo, mismo criterio que el home en 005 — sin
consumidor que lo necesite todavía).

## Datos
Sin tablas nuevas ni migración. Un repositorio nuevo, sin tocar los existentes:

- `findPublicBySlug(slug, executor)` en `product.repository.ts`: mismo join a
  `categories` que `listPaginated`, filtra `isActive = true` — un producto inactivo
  o un slug inexistente devuelven `null` (la página responde 404 con `notFound()`,
  nunca expone productos dados de baja).

## Decisiones técnicas
Numeración local al spec 007.

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **D1 — Detalle vía Server Component + repositorio directo**, sin `GET /api/products/[slug]` público. | Crear el endpoint y consumirlo con TanStack Query. | Mismo criterio que el home (005 §4, "lectura inicial, SEO"): una ficha de producto es la página con más peso SEO de toda la tienda. Nadie más necesita ese endpoint hoy; se agrega el día que un consumidor real lo pida (p. ej. una app externa). |
| **D2 — La imagen y el nombre de `ProductCard` pasan a ser el mismo `<Link>`**; el bloque de precio + control de carrito queda **fuera** del link, como hermano. | Envolver toda la card en un `<Link>` y usar `stopPropagation()` en el botón/stepper. | Un `<button>` dentro de un `<a>` es HTML inválido (interactivo anidado) y complica el foco de teclado/lectores de pantalla. Dos elementos clicables independientes (imagen+nombre → detalle, control de carrito → cantidad) no tienen ese problema y no necesitan trucos de eventos. |
| **D3 — `AddToCartControl` es un componente nuevo compartido**, no una rama de `if` dentro de `ProductCard`. | Duplicar el stepper en `ProductCard` y en la página de detalle. | Tercer consumidor real inmediato (grid, detalle, y el CTA del hero de 005 se migra también) — con eso ya se cumple "se extrae a la tercera repetición" del criterio DRY del proyecto. |
| **D4 — El dropdown de búsqueda reusa `useStorefrontProducts`** con un query mínimo (`q`, `pageSize: 5`, sin categorías/bandas), no un hook ni servicio nuevo. | Servicio de "autocomplete" aparte. | Es la misma ruta pública (`/api/products`) con los mismos parámetros ya soportados; no hay nada que autocompletar-específico que justifique un contrato nuevo. |
| **D5 — El dropdown no tiene botón de agregar al carrito en sus filas.** | Mostrar un mini `AddToCartControl` en cada fila del dropdown. | Es literalmente cómo se cumple el pedido "no debe agregar el producto al carrito": si la fila no tiene ningún control de carrito, no hay ninguna interacción posible que lo dispare por accidente. |
| **D6 — El stock limita el stepper** (`+` deshabilitado si `qty >= stock`), igual que ya limita el botón "+" actual. | Sin tope, dejar que el carrito tenga más unidades que stock disponible. | Ya era el comportamiento implícito del botón simple (`disabled={stock === 0}`); el stepper solo lo extiende al resto de las unidades, consistente con no vender de más. |

## Reutilizar
- `src/server/repositories/product.repository.ts` (`findBySlug`, patrón de join de
  `listPaginated`) · `src/modules/cart/store/cart-store.ts` (`addItem`, `setQty`,
  ya soportan todo lo que necesita el stepper, sin cambios) ·
  `src/modules/products/components/storefront/product-image.tsx` ·
  `src/hooks/use-debounce.ts` (ya usado en filtros admin, mismo patrón para el buscador) ·
  `src/modules/products/hooks/use-storefront-products.ts` (`useStorefrontProducts`,
  D4) · `formatPriceFromCents` · componentes shadcn ya instalados (`button`, `badge`).
- `src/modules/products/components/storefront/hero-carousel.tsx`: su botón "Agregar
  al carrito" se reemplaza por `AddToCartControl` (D3), sin tocar el resto del
  carrusel.

## Criterios de aceptación
- [x] AC1 — `/products/<slug-real>` muestra imagen, nombre, categoría (enlazada al
  catálogo filtrado), precio (con precio tachado si hay oferta), badge real
  (Agotado/-N%) y descripción.
- [x] AC2 — `/products/<slug-inexistente>` responde 404. El caso "producto inactivo"
  usa el mismo filtro `isActive = true` ya probado en `listPaginated`/`getFacetCounts`
  (005/006); no se creó un producto inactivo para repetir la prueba en runtime.
- [ ] AC3 — **Sin verificar en navegador esta sesión** (interacción de click, ver
  Verificación).
- [ ] AC4 — **Sin verificar en navegador esta sesión.**
- [ ] AC5 — **Sin verificar en navegador esta sesión.**
- [ ] AC6 — **Sin verificar en navegador esta sesión.**
- [x] AC7 — La API que alimenta el dropdown (`/api/products?q=`) devuelve
  coincidencias reales; el renderizado del dropdown en sí (debounce, aparición al
  enfocar) es interacción de navegador, sin verificar.
- [ ] AC8 — **Sin verificar en navegador esta sesión.**
- [x] AC9 — Sin cambios respecto a lo ya construido (el submit sigue armando
  `/products?q=`); no se tocó ese código en este spec.
- [x] AC10 — `npm run typecheck && npm run lint && npm run build` en verde.

## Tareas
Una capa por tarea, en orden de dependencia.

- [x] T1 — `findPublicBySlug(slug, executor)` (join a categorías, `isActive = true`)
  · `src/server/repositories/product.repository.ts`
- [x] T2 — `AddToCartControl` (botón "+" ↔ stepper `- N +`, tope en `stock`, D3/D6) ·
  `src/modules/products/components/storefront/add-to-cart-control.tsx`
- [x] T3 — `ProductCard`: imagen + nombre pasan a `<Link>` (D2); el bloque de precio
  usa `AddToCartControl` en vez del botón inline ·
  `src/modules/products/components/storefront/product-card.tsx`
- [x] T4 — `HeroCarousel`: su CTA usa `AddToCartControl` (D3) ·
  `src/modules/products/components/storefront/hero-carousel.tsx`
- [x] T5 — `src/app/(storefront)/products/[slug]/page.tsx`: Server Component,
  `generateMetadata`, `notFound()` si `findPublicBySlug` da `null` (D1/AC2)
- [x] T6 — `SearchResultsDropdown` (debounced con `useDebounce`, `useStorefrontProducts`
  con `q`/`pageSize: 5`, D4/D5, sin control de carrito en las filas) ·
  `src/components/shared/header.tsx` (o componente propio importado ahí)
- [x] T7 — `npm run typecheck && npm run lint && npm run build`

## Notas
- **`generateMetadata` en vez de `metadata` estático** (T5): el título depende del
  producto (`slug`), no puede ser un export fijo como en `/products` (006).
- **El dropdown se cierra** al navegar o al perder foco (`blur`), mismo patrón que
  ya usa el mock de diseño original (`focusSearch`/`blurSearch` con `setTimeout` para
  no comerse el click de una fila antes de que registre).
- **Sin tests.** Mismo estado que specs anteriores: verificación por
  `typecheck`/`lint`/`build` más repaso manual de los AC; varios de estos (AC3-AC9)
  son de interacción en navegador — mismo límite sin herramienta de navegador que
  cerró 005/006, se documentará igual en la verificación final.

## Verificación
Verificación propia en esta sesión (sin agente `reviewer` disponible): `npm run
typecheck`, `npm run lint` y `npm run build` en verde (AC10, incluye la nueva ruta
`/products/[slug]` generada como dinámica). Con `next dev` levantado contra los
datos reales:

- AC1 — `curl http://localhost:3000/products/ultrabook-x1` → 200, con el `<title>`
  "UltraBook X1 14” | E-commerce Tech" (`generateMetadata`), precio "1299,00",
  descripción, "12 unidades disponibles" y el breadcrumb a `/products?categories=laptops`.
- AC2 — `curl http://localhost:3000/products/no-existe-este-slug` → 404.
- Regresión — `/` y `/products` siguen en 200 tras restructurar `ProductCard` con
  dos `<Link>` (imagen y nombre); `GET /api/products?q=ultra` sigue devolviendo
  "UltraBook X1 14”" (la misma ruta que ahora alimenta el dropdown del header).

**AC3-AC6 y AC8 quedan sin marcar**: son de interacción real en navegador (click en
el stepper, click en la imagen/nombre de una card, click en una fila del dropdown) y
esta sesión no tiene esa herramienta — mismo límite que cerró 005/006. Revisados por
lectura de código: `AddToCartControl` lee `qty` del store y alterna botón/stepper
sin flag adicional; `ProductCard` ya no tiene ningún `<button>` dentro de los dos
`<Link>` (imagen, nombre), así que no hay conflicto de navegación posible por
construcción, no por un guard en tiempo de ejecución; `SearchResultsDropdown` no
importa `useCartStore` en absoluto, por lo que un click ahí no tiene ninguna vía
para llamar `addItem`. Recomendado antes de cerrar el spec como `done`: correr
`npm run dev`, agregar un producto al carrito desde la grilla y el detalle, y
escribir en el buscador para confirmar el dropdown y el click a la ficha.
