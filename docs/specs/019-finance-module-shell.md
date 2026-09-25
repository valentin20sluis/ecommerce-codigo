---
id: 019
title: Finanzas — Módulo único con secciones en pestañas
status: done
module: finance
scope: admin
---

# 019 — Finanzas — Módulo único con secciones en pestañas

## Objetivo
Un usuario con `finance.read` entra a un único módulo **Finanzas** (`/admin/finance`) y navega
entre sus 6 secciones (Precio unitario, Ingresos, Egresos, Impuestos, Ganancias, Contabilidad)
mediante **pestañas** compartidas en la parte superior, sin entradas sueltas en el sidebar.

## Contexto
Las fases 015–017 quedaron dispersas (verificado): `admin-shell.tsx` tiene 3 entradas
(`/admin/finance/unit-price` "Finanzas", `/revenue` "Ingresos", `/expenses` "Egresos"); no existe
`finance/layout.tsx` ni `finance/page.tsx`; cada página repite `<main>` y el guard
`can(PERMISSIONS.FINANCE_READ)` → `redirect("/admin")`. El sidebar no marca ningún item activo.
Esta spec es prerrequisito de 018 (Impuestos) y de las fases 5 y 6.

## Alcance
Incluye:
- Una sola entrada "Finanzas" → `/admin/finance` en el sidebar, activa por prefijo de ruta.
- `finance/layout.tsx`: guard `finance.read` centralizado + `<main>` + pestañas de sección.
- `finance/page.tsx` como entrada del módulo (ver D3).
- Constante única de secciones: cada fase futura solo crea su página y activa su sección.
- Secciones no construidas (Impuestos, Ganancias, Contabilidad) como pestañas deshabilitadas con "Próximamente".

No incluye:
- Cambios de API, datos, permisos ni en el comportamiento de los tres managers existentes.
- Páginas placeholder para las secciones pendientes (una URL directa a ellas sigue dando 404; la UI nunca enlaza ahí).
- Ocultar secciones o el item del sidebar por permiso (se mantiene D15 de 015: sin gating en nav).

## Decisiones
| # | Decisión |
|---|---|
| D1 | `FINANCE_SECTIONS` en `src/modules/finance/sections.ts` es la única fuente de las secciones: `{ slug, label, href, status: 'available' \| 'soon' }`, en el orden del roadmap de 015. Activar una fase = crear su `page.tsx` y cambiar su `status` a `'available'`. `admin-shell.tsx` no vuelve a tocarse por Finanzas. |
| D2 | Sección `'soon'` se renderiza como pestaña deshabilitada (`TabsTrigger disabled`) con `Badge` "Próximamente", **no** como `Link`: no hay navegación posible a una ruta inexistente. |
| D3 | **CONFIRMADO por el humano: (a) redirect.** **(a) redirect** de `/admin/finance` a la primera sección `'available'` de `FINANCE_SECTIONS` (hoy `unit-price`). Motivo: la sub-navegación ya muestra las 6 secciones y su estado, así que una landing con tarjetas sin cifras solo duplica esa navegación; una portada con KPIs reales encaja cuando exista Ganancias (fase 5). Alternativa (b): landing con una `Card` por sección (etiqueta + descripción + enlace o "Próximamente"); si se elige, `FINANCE_SECTIONS` gana un campo `description` y T4 cambia. |
| D4 | Pestaña activa: la sección cuyo `href` cumple `pathname === href \|\| pathname.startsWith(href + '/')` es el `value` de `Tabs`. Sidebar: mismo criterio por prefijo; `/admin` (Dashboard) solo por igualdad exacta. |
| D5 | El `<h1>` y la descripción de cada sección siguen en su página (el layout no añade título propio: evita dos `<h1>`). Los permisos de escritura (`FINANCE_MANAGE_COSTS`, `FINANCE_MANAGE_EXPENSES`) se siguen calculando en cada página y pasando como prop. |
| D6 | Las secciones son **pestañas de ruta** con el componente shadcn `Tabs` ya instalado (`src/components/ui/tabs.tsx`, Base UI): `Tabs value={sección activa}` + `TabsList variant="line"` + un `TabsTrigger` por sección que navega a su `href` (renderizado como `Link`). Sin `TabsContent`: el contenido es la página hija (`children`), no un panel. Variante `line` para distinguirlas de las pestañas internas de Egresos (Egresos / Recurrentes, variante por defecto). Componente cliente (`usePathname`); el layout sigue siendo Server Component. El link activo del sidebar se extrae a un componente cliente mínimo; `AdminShell` sigue siendo servidor. |

## Datos
Sin cambios de esquema.

## API
Sin cambios. `middleware.ts` (verificado): `/admin/finance/**` cae en `isAdminRoute` (`/admin(.*)`)
y no figura en `isUnauthenticatedRoute`, así que exige sesión; no requiere cambios.

## Reutilizar
- `src/components/ui/tabs.tsx` — `Tabs`, `TabsList` (variante `line`), `TabsTrigger` (ya instalado; ningún shadcn nuevo). Uso de referencia: `expenses-manager.tsx`.
- `src/modules/customers/components/profile-nav.tsx` — patrón de nav de ruta con `usePathname` + `cn` (solo para el cálculo de activo).
- `src/lib/permissions` — `can`, `PERMISSIONS.FINANCE_READ` (guard del layout).
- `src/app/(admin)/admin/layout.tsx` — patrón de layout con `LayoutProps<"/admin">`.
- `src/components/ui/badge.tsx`, `card.tsx` (ya instalados; `card` solo si D3 = b) — ningún shadcn nuevo.
- `src/lib/utils.ts` (`cn`).

## Criterios de aceptación
- [x] AC1 — Dado el sidebar, entonces hay una sola entrada "Finanzas" → `/admin/finance` y ya no existen "Ingresos" ni "Egresos" como entradas propias.
- [x] AC2 — Dada cualquier ruta `/admin/finance/**`, entonces el item "Finanzas" del sidebar se ve activo; en `/admin` solo "Dashboard" está activo.
- [x] AC3 — Dada cualquier sección disponible, entonces se muestran las 6 pestañas en orden en la parte superior del módulo y la de la sección actual queda seleccionada (`aria-selected="true"`).
- [x] AC4 — Dadas Impuestos, Ganancias y Contabilidad, entonces aparecen como pestañas deshabilitadas con "Próximamente" y no se puede navegar a ellas desde la UI.
- [x] AC10 — Dado un clic en una pestaña disponible, entonces navega a su ruta sin recargar el layout y el contenido cambia a esa sección (sin `TabsContent`).
- [ ] AC5 — Dado un usuario sin `finance.read`, cuando abre `/admin/finance` o cualquier sección, entonces es redirigido a `/admin`.
- [x] AC6 — Dado `/admin/finance`, entonces se comporta según D3 confirmado (redirect a Precio unitario, o landing con una tarjeta por sección).
- [x] AC7 — Dadas las 3 páginas existentes, entonces ninguna contiene `<main>` ni `can(PERMISSIONS.FINANCE_READ)`, y conservan título, descripción, `Suspense` y props de permisos de escritura (mismo comportamiento que antes).
- [x] AC8 — Dado el código, entonces `grep "/admin/finance/" src/components/shared/admin-shell.tsx` no devuelve nada.
- [x] AC9 — Dado un usuario sin sesión, cuando pide `/admin/finance/revenue`, entonces el middleware lo redirige a sign-in (sin cambios en `middleware.ts`).

## Tareas
- [x] T1 — Crear `FINANCE_SECTIONS` (6 secciones; 3 `available`, 3 `soon`) y su tipo inferido · `src/modules/finance/sections.ts`
- [x] T2 — Crear `FinanceTabs` (cliente): `Tabs` + `TabsList variant="line"`; `TabsTrigger` que navega vía `Link` para `available`, `disabled` + `Badge` para `soon`; activa según D4 · `src/modules/finance/components/finance-tabs.tsx`
- [x] T3 — Crear layout: guard `can(FINANCE_READ)` → `redirect("/admin")`, `<main className="flex flex-1 flex-col gap-6 p-8">` con `FinanceTabs` y `children` · `src/app/(admin)/admin/finance/layout.tsx`
- [x] T4 — Crear entrada del módulo según D3 · `src/app/(admin)/admin/finance/page.tsx`
- [x] T5 — Quitar `<main>` y guard `FINANCE_READ`; conservar `FINANCE_MANAGE_COSTS` · `src/app/(admin)/admin/finance/unit-price/page.tsx`
- [x] T6 — Quitar `<main>` y guard `FINANCE_READ` · `src/app/(admin)/admin/finance/revenue/page.tsx`
- [x] T7 — Quitar `<main>` y guard `FINANCE_READ`; conservar `FINANCE_MANAGE_EXPENSES` · `src/app/(admin)/admin/finance/expenses/page.tsx`
- [x] T8 — Crear `AdminNavLink` (cliente) con activo por prefijo según D4 · `src/components/shared/admin-nav-link.tsx`
- [x] T9 — Reemplazar las 3 entradas de finanzas por `{ href: "/admin/finance", label: "Finanzas" }` y renderizar con `AdminNavLink` · `src/components/shared/admin-shell.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- En App Router el layout y la página se renderizan en paralelo: el código servidor de la página
  corre aunque el layout redirija. Por eso las páginas de Finanzas **no pueden leer datos sensibles
  en servidor** sin su propio check; hoy solo calculan booleanos `can(...)` y los datos llegan por
  API con `requirePermission` en el handler (capa de seguridad real). Aplica también a 018, 5 y 6.
- El layout no se re-ejecuta en navegación cliente entre secciones: un permiso revocado se aplica en
  la siguiente carga completa; los handlers lo exigen en cada petición igualmente.
