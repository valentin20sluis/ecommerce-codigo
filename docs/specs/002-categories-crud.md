---
id: 002
title: Categorías del catálogo (CRUD admin)
status: done
module: products
scope: admin
created: 2026-08-29
---

# 002 — Categorías del catálogo (CRUD admin)

> **Estado del documento.** Las secciones §1–§11 describen la Fase 1, que está
> **implementada y verificada** (T1–T21 hechas, AC1–AC15 en verde). La **Enmienda 1
> (§12): acceso sin autenticación a `/admin/categories`** fue aprobada e implementada
> (T22–T30 hechas, AC16–AC24 en verde) y el spec queda en `status: done`. §1–§11 no
> se reescriben —son el registro de lo ya construido—, solo se anotan con punteros a §12,
> que es quien manda donde ambos se contradicen.

## 1. Contexto

El spec 001 dejó la base de identidad, RBAC y auditoría funcionando (`users`, `roles`,
`permissions`, `audit_logs`, `requirePermission`, `logAudit`, `DataTable` compartido).
El catálogo, en cambio, sigue vacío: `src/server/db/schema/index.ts` reexporta seis
tablas y ninguna es de dominio comercial. `docs/SETUP.md` §5.3 declara `categories` como
la raíz de la taxonomía (`1—N products`).

Verificado en el repositorio: `src/modules/categories/` existe con sus cinco carpetas
(`components`, `hooks`, `schemas`, `services`, `types`) **todas vacías**;
`src/app/(admin)/admin/categories/` existe y está vacío; `src/app/api/categories/`
existe y está vacío. El andamiaje está puesto y sin una sola línea escrita.

Esta es la Fase 1 del catálogo y es deliberadamente estrecha: entrega la tabla, su CRUD
de administración y la tabla filtrable. `products` es una fase futura y **no se toca**.

## 2. Objetivo

Un administrador puede crear, buscar, filtrar, editar y eliminar categorías desde
`/admin/categories`, con paginación y filtrado resueltos en el servidor y con cada
mutación registrada en `audit_logs` dentro de la misma transacción.

## 3. Alcance

### Incluye

- Tabla `categories` y su migración Drizzle.
- `src/server/repositories/category.repository.ts` con listado paginado, búsqueda y
  filtro por estado.
- `src/server/services/category.service.ts`: mutación + auditoría en una transacción.
- API admin: `GET`/`POST` `/api/admin/categories` y `GET`/`PATCH`/`DELETE`
  `/api/admin/categories/[id]`.
- Módulo cliente `src/modules/categories/`: schemas Zod, tipos, service axios, hooks de
  TanStack Query, filtros sincronizados con la URL y componentes.
- Página `/admin/categories` (TanStack Table vía `DataTable`, buscador por nombre,
  filtro por estado, paginación) y su entrada en el menú lateral del panel.
- Helper puro `slugify()` en `src/lib/utils.ts`.

### No incluye (explícito)

- Cualquier cambio en `products` o en su schema. Es una fase separada.
- Jerarquía de categorías: sin `parentId`, sin subcategorías (D1).
- Permisos `categories.*` ni `requirePermission()` en los handlers (D2, §11). Es una
  desviación deliberada y temporal de CLAUDE.md §4 regla 8.
- API pública `/api/categories` para el storefront. `src/middleware.ts` ya la declara
  pública en `isPublicRoute`, pero el handler no se escribe en esta fase.
- UI de storefront: esta feature no toca `(storefront)`.
- Soft delete (`deletedAt`). El borrado es físico (D3).
- Imagen de portada, orden manual (`sortOrder`), SEO meta, traducciones.
- Seed de categorías de ejemplo.
- Ordenamiento por columna en la tabla: `DataTable` se construyó con
  `tableFeatures({})` y no expone sorting (verificado en
  `src/components/shared/data-table.tsx:24`).

## 4. Criterios de aceptación

- [x] **AC1** — Dado un admin en `/admin/categories`, cuando la página carga sin filtros,
  entonces ve las categorías paginadas de 20 en 20, ordenadas por `name` ascendente, y el
  pie de la tabla muestra el total y la página actual.
- [x] **AC2** — Dado el buscador con el texto `mon`, cuando pasan 300 ms sin nuevas
  pulsaciones, entonces la tabla muestra solo las categorías cuyo `name` contiene `mon`
  sin distinguir mayúsculas, y la página vuelve a 1.
- [x] **AC3** — Dado el filtro de estado en `Activas`, cuando se aplica, entonces la tabla
  muestra solo las categorías con `isActive = true`; con `Inactivas`, solo las
  `isActive = false`; con `Todas`, ambas.
- [x] **AC4** — Dado un buscador y un filtro aplicados, cuando se copia la URL y se abre en
  otra pestaña, entonces la vista se reconstruye con los mismos filtros, página y tamaño
  de página.
- [x] **AC5** — Dado un admin que envía `{ name, slug }` válidos, cuando confirma el
  formulario, entonces la respuesta es 201, la categoría aparece en la tabla sin recargar
  y existe una fila en `audit_logs` con `action = 'category.created'` y
  `entity_type = 'category'`.
- [x] **AC6** — Dado un `slug` que ya existe, cuando se intenta crear la categoría,
  entonces la respuesta es 409 `CONFLICT`, el mensaje se muestra dentro del diálogo y no
  se inserta ninguna fila ni en `categories` ni en `audit_logs`.
- [x] **AC7** — Dado un payload con `name` vacío o un `slug` con mayúsculas o espacios,
  cuando llega al handler, entonces la respuesta es 400 `VALIDATION_ERROR` y no se ejecuta
  ninguna consulta de escritura.
- [x] **AC8** — Dado un admin que edita la descripción de una categoría, cuando guarda,
  entonces la respuesta es 200 y la fila de `audit_logs` con
  `action = 'category.updated'` tiene en `changes` **solo** el campo `description`.
- [x] **AC9** — Dado un `PATCH` cuyos valores son idénticos a los actuales, cuando se
  procesa, entonces la respuesta es 200 y **no** se escribe ninguna fila en `audit_logs`.
- [x] **AC10** — Dado un admin que confirma el borrado, cuando la operación termina,
  entonces la respuesta es 204, la categoría desaparece de la tabla y existe una fila en
  `audit_logs` con `action = 'category.deleted'`, `severity = 'warning'` y el registro
  anterior en `changes.before`.
- [x] **AC11** — Dado un `id` con formato uuid que no existe, cuando se llama `GET`,
  `PATCH` o `DELETE` sobre `/api/admin/categories/[id]`, entonces la respuesta es 404 y no
  se muta nada.
- [x] **AC12** — Dado un `id` que no es un uuid, cuando llega a cualquier handler de
  `[id]`, entonces la respuesta es 400 `VALIDATION_ERROR`.
- [x] **AC13** — Dado un visitante anónimo, cuando llama `GET /api/admin/categories`,
  entonces recibe 401 en JSON con el envelope de `src/lib/api-error.ts`; y cuando visita
  `/admin/categories`, entonces es redirigido a `/sign-in` por el layout existente.
- [x] **AC14** — Dada la tabla, cuando la consulta está cargando muestra filas skeleton;
  cuando falla muestra el mensaje de error en rojo; y cuando no hay resultados muestra el
  texto de estado vacío. Los tres estados los provee `DataTable` sin código nuevo.
- [x] **AC15** — `npm run typecheck && npm run lint && npm run build` en verde.

### Cómo se verificó cada AC

- **Por código y contratos Zod** (trazable leyendo repositorio, handlers, schemas y
  componentes, confirmado en la revisión): AC1, AC2, AC3, AC4, AC7, AC12, AC13, AC14.
- **En runtime contra Neon**: AC5, AC6, AC8, AC9, AC10 y AC11 se ejecutaron con un script
  temporal (`tsx --env-file=.env.local`) que llamó en secuencia a `createCategory`,
  `updateCategory` y `deleteCategory` de `src/server/services/category.service.ts` y
  comprobó las filas resultantes en `categories` y `audit_logs`. AC6 se ejercitó por dos
  vías: el pre-chequeo de `findBySlug` y la carrera real —una transacción retiene el slug
  sin commitear mientras un segundo alta pasa el pre-chequeo y choca contra el índice
  único—, que ahora devuelve `ConflictError` y no un 500. El script se borró y la BD quedó
  en su estado inicial (`categories = 0`, `audit_logs` con `entity_type='category'` = 0),
  verificado con `count(*)` antes y después.
- **Sin ejercitar por falta de sesión Clerk real**: AC13 se verificó solo a nivel de
  contrato y código (`isAdminRoute` en `src/middleware.ts`, `requireAuth()` en los cinco
  handlers y `requireAdmin()` en el layout), **no** navegando con una sesión anónima real
  en el navegador; por el mismo motivo, el recorrido de UI de AC1–AC4 y AC14 se verificó
  leyendo los componentes y no con clics. La tabla `users` está vacía, así que el script
  de runtime creó y borró un actor temporal para satisfacer el `actorId` de `logAudit`.

## 5. Modelo de datos

Una tabla nueva. **Requiere migración** (`npm run db:generate` + `npm run db:migrate`).

Convención heredada del spec 001 y de `docs/SETUP.md` §3: un archivo por tabla, nombre
singular en kebab-case, tabla en snake_case plural, `uuid` con `defaultRandom()`,
timestamps `withTimezone: true`, tipos inferidos con `InferSelectModel` /
`InferInsertModel`.

**Asunción de partida (D1): la lista es plana.** No hay `parentId` ni subcategorías. Si
el modelo real necesita jerarquía, hay que corregirlo **en la aprobación de este spec**:
añadirlo después obliga a migrar datos y a rehacer la tabla y el formulario.

Sin columna de precio: las categorías no tienen precio (la regla de enteros/centavos de
CLAUDE.md §6 no aplica aquí).

### 5.1 `categories` — `src/server/db/schema/category.ts`

```ts
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("categories_slug_unique").on(t.slug),
    index("categories_name_idx").on(t.name),
  ],
);

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;
```

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK `defaultRandom()` | |
| `name` | text NOT NULL | nombre visible; 2–80 caracteres por contrato Zod |
| `slug` | text NOT NULL, único | identificador de URL para el storefront futuro |
| `description` | text NULL | texto de apoyo, máx. 280 por contrato Zod |
| `is_active` | boolean NOT NULL default `true` | permite ocultar sin borrar |
| `created_at` | timestamptz NOT NULL default `now()` | |
| `updated_at` | timestamptz NOT NULL default `now()` | lo actualiza el repositorio en cada `update` |

**Índices**: `categories_slug_unique` (unicidad del slug, exigida por AC6) y
`categories_name_idx` (sostiene el `order by name asc` del listado paginado; **no**
acelera el `ILIKE '%…%'` del buscador — ver §10).

**Sin `relations()`** en esta fase: no hay ninguna tabla con la que relacionar hasta que
exista `products` (D12).

**Barrel**: añadir `export * from "./category";` a `src/server/db/schema/index.ts`, que
hoy reexporta `audit-log`, `permission`, `role`, `role-permission`, `user` y `user-role`.

## 6. Contratos de API

Envelope de error y de listas paginadas idénticos al spec 001:

```jsonc
{ "error": { "code": "CONFLICT", "message": "…", "details": null } }
{ "data": [], "meta": { "page": 1, "pageSize": 20, "total": 0 } }
```

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| GET | `/api/admin/categories` | sesión autenticada (D2) | query: `q`, `status`, `page`, `pageSize` | `{ data: CategoryDto[], meta }` | 400, 401, 500 |
| POST | `/api/admin/categories` | sesión autenticada (D2) | `CreateCategoryInput` | `CategoryDto` (201) | 400, 401, 409, 500 |
| GET | `/api/admin/categories/[id]` | sesión autenticada (D2) | — | `CategoryDto` | 400, 401, 404, 500 |
| PATCH | `/api/admin/categories/[id]` | sesión autenticada (D2) | `UpdateCategoryInput` | `CategoryDto` | 400, 401, 404, 409, 500 |
| DELETE | `/api/admin/categories/[id]` | sesión autenticada (D2) | — | `204` sin cuerpo | 400, 401, 404, 500 |

La columna **Auth** no dice 403 a propósito: estos handlers no verifican permisos (D2).
El 401 lo produce `src/middleware.ts` en el borde para todo `/api/admin(.*)`, y en
segunda instancia `requireAuth()` dentro del handler, que además devuelve el `User` que
`logAudit` necesita como actor.

> **Modificado por la Enmienda 1 (§12.6).** La columna **Auth** de las cinco filas pasa
> de `sesión autenticada` a `sin autenticación`, y el 401 desaparece de la columna de
> errores. El actor de `logAudit` pasa a ser opcional.

### Schemas Zod

En `src/modules/categories/schemas/category.schema.ts`. Los importa el handler (entrada)
y el formulario del cliente (validación con `zodResolver`), exactamente como
`role.schema.ts`.

```ts
export const CATEGORY_STATUS_FILTERS = ["all", "active", "inactive"] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(SLUG_PATTERN, "Usa minúsculas, números y guiones simples."),
  description: z.string().max(280).nullish(),
  isActive: z.boolean().default(true),
});

// Edición parcial: cualquier campo, incluido el slug (ver D5 y §10).
export const updateCategorySchema = createCategorySchema.partial().extend({
  // `.partial()` NO anula el `.default(true)`: sin esto, `parse({ description })`
  // devuelve `{ description, isActive: true }` (verificado en runtime con Zod 4.5).
  isActive: z.boolean().optional(),
});

export const categoriesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(CATEGORY_STATUS_FILTERS).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoriesQuery = z.infer<typeof categoriesQuerySchema>;
```

> **Corrección durante la implementación (T21).** El sketch original decía
> `createCategorySchema.partial()` a secas. Verificado en runtime: `.partial()` no
> desactiva el `.default(true)` de `isActive`, así que un `PATCH { description }` sobre
> una categoría inactiva la habría **reactivado en silencio** y habría metido `isActive`
> en `changes`, rompiendo AC8 y AC9. El `.extend({ isActive: z.boolean().optional() })`
> restablece la semántica pretendida: campo omitido = campo sin cambio.

El `id` de ruta se valida con `z.uuid().parse(id)` dentro de un `resolveId(context)`
local, mismo patrón que `src/app/api/admin/roles/[id]/route.ts:12`.

### Tipos de salida

En `src/modules/categories/types/index.ts`, derivados del schema Drizzle vía
`Serialized<T>` de `src/types/api.ts` (CLAUDE.md §4 regla 5):

```ts
export type CategoryDto = Serialized<Category>;
export type CategoryListResponse = Paginated<CategoryDto>;
```

## 7. Arquitectura y archivos afectados

Mapa capa por capa según `docs/SETUP.md` §3 y §4.

- `src/server/db/schema/` — **nuevo** `category.ts`; `index.ts` añade el reexport.
- `drizzle/` — nueva migración generada por drizzle-kit.
- `src/server/repositories/` — **nuevo** `category.repository.ts`: funciones puras
  exportadas, `ReadExecutor = db` por defecto en lecturas y `Executor` explícito como
  primer parámetro en escrituras (patrón de `role.repository.ts`). Superficie:
  `findById`, `findBySlug`, `listPaginated`, `create`, `update`, `remove`.
- `src/server/services/` — **nuevo** `category.service.ts`: `createCategory`,
  `updateCategory`, `deleteCategory`, cada una dentro de `dbTx.transaction()` y con
  `logAudit(tx, …)` en la misma transacción. Usa `diffChanges` en la edición.
- `src/app/api/admin/categories/` — **nuevos** `route.ts` (GET, POST) y
  `[id]/route.ts` (GET, PATCH, DELETE). Patrón
  `try { … } catch (error) { return toErrorResponse(error) }`; DELETE responde 204 con
  `new NextResponse(null, { status: 204 })`.
- `src/lib/utils.ts` — añade `slugify()` (D5). No se toca `cn()`.
- `src/modules/categories/schemas/` — `category.schema.ts`.
- `src/modules/categories/types/` — `index.ts`.
- `src/modules/categories/services/` — `category.service.ts`, wrapper tipado sobre `api`
  de `src/lib/axios.ts`.
- `src/modules/categories/hooks/` — `use-categories.ts` (`categoryKeys`, `useCategories`
  con `placeholderData: keepPreviousData`, `useCategoryFilters` sincronizado con la URL)
  y `use-category-mutations.ts` (create / update / delete con
  `invalidateQueries({ queryKey: categoryKeys.all })`).
- `src/modules/categories/components/` — `category-filters.tsx`, `category-table.tsx`,
  `category-form-dialog.tsx`, `category-delete-dialog.tsx`, `category-manager.tsx`.
- `src/app/(admin)/admin/categories/page.tsx` — **nueva** página fina, envuelve
  `<CategoryManager />` en `<Suspense>` porque el hook de filtros usa `useSearchParams`
  (mismo motivo que `admin/audit-logs/page.tsx:22`).
- `src/app/(admin)/admin/layout.tsx` — añadir
  `{ href: "/admin/categories", label: "Categorías" }` a `NAV_ITEMS`. **El guard
  `requireAdmin()` no se toca.**
- `src/components/ui/` — **sin cambios**. Verificado que ya están instalados los 22
  componentes necesarios, incluidos `checkbox`, `select`, `dialog`, `alert-dialog`,
  `input`, `label`, `field`, `textarea`, `badge`, `table` y `skeleton`. No hace falta
  ningún `npx shadcn@latest add` (D9).
- `src/middleware.ts` — **sin cambios**: `isAdminRoute` ya cubre `/api/admin(.*)`.
- `src/lib/permissions.catalog.ts` — **sin cambios**: no se añaden códigos
  `CATEGORIES_*` en esta fase (D2).

Todo el código —tabla, columnas, funciones, tipos y componentes— en inglés. Todo el texto
visible en la UI, en español.

> **Modificado por la Enmienda 1 (§12.7).** Las tres últimas afirmaciones dejan de ser
> ciertas tras la enmienda: la página se mueve fuera de `(admin)/admin/`, el guard
> `requireAdmin()` deja de cubrirla y `src/middleware.ts` sí se toca.

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **D1** — Lista plana: `categories` sin `parentId` ni auto-referencia. | Árbol de categorías con `parentId` auto-referenciado. | Decisión explícita del usuario para la Fase 1. Un árbol arrastra consigo CTE recursivas en el repositorio, validación de ciclos, borrado en cascada y un selector de padre en el formulario: multiplica el alcance de una fase cuyo objetivo es desbloquear `products`. Queda anotado como asunción revisable en la aprobación (§5) porque migrar a jerarquía después no es gratis. |
| **D2** — Los Route Handlers de categorías **no** llaman `requirePermission()`. Usan `requireAuth()` de `src/lib/auth.ts`, que devuelve el `User` autenticado o lanza 401. La protección de la página sigue siendo el `requireAdmin()` del layout, que no se toca. | Sembrar `categories.read/create/update/delete` en `permissions.catalog.ts` y proteger cada endpoint con `requirePermission()`, tal y como hacen los 11 endpoints del spec 001. | Decisión explícita y consciente del usuario para esta fase. **Es una desviación temporal de CLAUDE.md §4 regla 8 y de `docs/SETUP.md` §6**, no un olvido, y por eso está aquí y en §11 en lugar de aplicarse en silencio. Se elige `requireAuth()` y no un `getCurrentUser()` con comprobación de nulo manual porque el actor es obligatorio para `logAudit` y porque `requireAuth()` ya produce el 401 con el envelope correcto. Consecuencia de seguridad, cuantificada en §10: cualquier usuario autenticado —incluido un `customer` del storefront— puede mutar categorías vía API. La skill `clerk-nextjs-patterns` confirma el mapeo que se respeta aquí: 401 = no autenticado, 403 = autenticado sin permiso; en esta fase, sencillamente, no se emite ningún 403. |
| **D3** — Borrado físico, sin `deletedAt`. | Soft delete con `deletedAt` y filtrado en cada lectura. | Ningún dominio del repositorio usa soft delete salvo `users`, donde existe por exigencia del webhook de Clerk (`user.deleted`). `roles` y `audit_logs` hacen borrado físico. `isActive` ya cubre el caso de negocio real ("ocultar sin borrar") y el `audit_log` de `category.deleted` conserva el registro anterior en `changes.before`. |
| **D4** — El conflicto de slug se detecta dos veces: pre-chequeo con `findBySlug` dentro de la transacción y, además, traducción del error `23505` de Postgres a `ConflictError` en `category.service.ts`. | Solo el pre-chequeo, como hace `createRole` en `access-control.service.ts:51`. | El pre-chequeo solo es vulnerable a la carrera entre dos peticiones concurrentes: la segunda revienta contra el índice único y el usuario recibe un 500 opaco en vez de un 409. La traducción del `23505` cuesta una función `isUniqueViolation(error)` local al servicio y hace que AC6 sea determinista bajo concurrencia. |
| **D5** — `slug` editable siempre, con sugerencia automática desde `name` **solo mientras el campo no haya sido tocado y solo en creación**. El helper `slugify()` vive en `src/lib/utils.ts`. | (a) Slug inmutable tras la creación, como en `roles`. (b) Slug generado en el servidor y nunca visible. | En `roles` el slug es un identificador de código referenciado por `permissions.catalog.ts`, por eso es inmutable. En `categories` el slug es una URL de storefront: es contenido editorial y el admin debe poder corregir una errata. Generarlo en el servidor y ocultarlo impediría esa corrección. `slugify()` va a `lib/utils.ts` —descrito en §3 de SETUP como "cn() y helpers puros"— porque `products` lo necesitará idéntico en la fase siguiente; es el único helper que se anticipa a un segundo consumidor conocido. El coste de editar el slug se documenta en §10. |
| **D6** — El buscador mantiene estado local y empuja a la URL con `useDebounce(term, 300)` de `src/hooks/use-debounce.ts`. | Empujar en cada `onChange`, como hace `audit-log-filters.tsx`. | El hook de filtros llama `router.replace()` en cada cambio; sin debounce, escribir "monitores" dispara 9 navegaciones y 9 peticiones. `useDebounce` ya existe en el repositorio y hoy no lo usa nadie. Los `Select` de estado sí empujan de inmediato: son un clic, no una ráfaga. |
| **D7** — Paginación y filtrado en el servidor; el `DataTable` compartido recibe `data` ya paginada. | Traer todas las categorías y filtrar en cliente. | Hereda D11 del spec 001 y es lo único posible: `src/components/shared/data-table.tsx:24` construye la tabla con `tableFeatures({})`, sin ningún row model de filtrado, ordenamiento ni paginación. Cambiar eso está fuera de alcance. |
| **D8** — El filtro de estado viaja como `status: "all" \| "active" \| "inactive"`. | `isActive: z.coerce.boolean().optional()` en la query. | `z.coerce.boolean()` convierte `"false"` en `true`: cualquier valor no vacío es truthy. Un enum de tres valores hace explícito el estado "sin filtrar", sobrevive al round-trip por la URL y se mapea sin ambigüedad al `Select` de shadcn, que no admite `value=""`. |
| **D9** — `isActive` se edita con `Checkbox`. | Instalar `switch` de shadcn, que es el control habitual para un booleano de estado. | `switch` no está instalado; `checkbox` sí (verificado en `src/components/ui/`). Evita una dependencia nueva en una fase que no necesita ninguna. Si el panel adopta `switch` como estándar, se migra en una tarea de UI aparte. |
| **D10** — Servicio de servidor propio `category.service.ts`. | Añadir las funciones de categorías a `access-control.service.ts`. | SOLID (CLAUDE.md §6): `access-control.service.ts` es identidad y acceso. Mezclar catálogo ahí crea un archivo con dos razones para cambiar y un import de `categories` en el módulo de seguridad. |
| **D11** — El parámetro de búsqueda se llama `q`. | `search`, `name` o `term`. | `usersQuerySchema` del spec 001 ya usa `q` para el mismo propósito. Un segundo nombre para el mismo concepto es deuda de consistencia gratuita. |
| **D12** — El schema de `categories` no declara `relations()`. | Declarar ya la relación `1—N products`. | `products` no existe: el import no compilaría. La relación la añade el spec de `products`, que es quien introduce la FK `products.category_id`. |

**Skills**: del mapa de CLAUDE.md §8, en esta sesión están instaladas
`clerk-nextjs-patterns` (usada: fundamenta el mapeo 401/403 y el cacheo por request de
D2; confirma que `getCurrentUser()` envuelto en `cache()` es el patrón correcto),
`security-review` (opera sobre un diff pendiente y aquí todavía no hay código escrito;
debe ejecutarla el reviewer tras la implementación, con foco en D2), `code-review` y
`dataviz` (no aplica: esta feature no tiene gráficos). **No** están instaladas
`superpowers:brainstorming`, `superpowers:writing-plans`, `vercel:nextjs`,
`vercel:shadcn`, `vercel:vercel-storage`, `frontend-design` ni `web-design-guidelines`;
se procedió sin ellas y las afirmaciones sobre el código existente se verificaron
leyendo los archivos citados.

## 9. Tareas

Atómicas, ordenadas por dependencia, una capa por tarea, en el orden schema →
repositorio → API → service → hook → componente → página.

### F1 — Esquema y datos

- [x] **T1** — Crear la tabla `categories` con sus dos índices y los tipos inferidos ·
  archivo: `src/server/db/schema/category.ts` · verificación: `npm run typecheck`
- [x] **T2** — Reexportar `category` en el barrel · archivo:
  `src/server/db/schema/index.ts` · verificación: `npm run typecheck`
- [x] **T3** — Generar y aplicar la migración · archivo: `drizzle/` (generado) ·
  verificación: `npm run db:generate && npm run db:migrate`
- [x] **T4** — Repositorio con `findById`, `findBySlug`, `listPaginated` (filtros `q` con
  `ilike` sobre `name`, `status`, orden `asc(name)`, `count(*)::int` para el total),
  `create`, `update` (refresca `updatedAt`) y `remove` · archivo:
  `src/server/repositories/category.repository.ts` · verificación: `npm run typecheck`

### F2 — Contrato y servidor

- [x] **T5** — Schemas Zod de creación, edición y query, más los tipos inferidos ·
  archivo: `src/modules/categories/schemas/category.schema.ts` · verificación:
  `npm run typecheck`
- [x] **T6** — Servicio de dominio: `createCategory`, `updateCategory`, `deleteCategory`
  en `dbTx.transaction()`, con `logAudit` en la misma transacción, `diffChanges` en la
  edición y traducción del error `23505` a `ConflictError` (D4) · archivo:
  `src/server/services/category.service.ts` · verificación: `npm run typecheck`
- [x] **T7** — Route Handler de colección: `GET` (parsea la query con Zod y devuelve
  `{ data, meta }`) y `POST` (201) · archivo: `src/app/api/admin/categories/route.ts` ·
  verificación: `npm run typecheck && npm run lint`
- [x] **T8** — Route Handler de recurso: `GET`, `PATCH` y `DELETE` (204), con
  `resolveId()` validando el uuid · archivo:
  `src/app/api/admin/categories/[id]/route.ts` · verificación:
  `npm run typecheck && npm run lint`

### F3 — Módulo cliente

- [x] **T9** — Tipos `CategoryDto` y `CategoryListResponse` derivados de `Serialized<T>` ·
  archivo: `src/modules/categories/types/index.ts` · verificación: `npm run typecheck`
- [x] **T10** — Service axios tipado: `fetchCategories`, `fetchCategory`,
  `createCategory`, `updateCategory`, `deleteCategory` · archivo:
  `src/modules/categories/services/category.service.ts` · verificación:
  `npm run typecheck`
- [x] **T11** — `categoryKeys`, `useCategories(query)` con `keepPreviousData` y
  `useCategoryFilters()` sincronizado con la URL (`setFilters` resetea `page` a 1;
  `router.replace(…, { scroll: false })`) · archivo:
  `src/modules/categories/hooks/use-categories.ts` · verificación: `npm run typecheck`
- [x] **T12** — Mutaciones `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`
  invalidando `categoryKeys.all` · archivo:
  `src/modules/categories/hooks/use-category-mutations.ts` · verificación:
  `npm run typecheck`
- [x] **T13** — Helper puro `slugify(value: string): string` · archivo:
  `src/lib/utils.ts` · verificación: `npm run typecheck`
- [x] **T14** — Barra de filtros: buscador con debounce de 300 ms, `Select` de estado y
  botón de limpiar; recibe `filters`/`onChange`/`onReset` por props y no conoce TanStack
  Query · archivo: `src/modules/categories/components/category-filters.tsx` ·
  verificación: `npm run typecheck && npm run lint`
- [x] **T15** — Tabla sobre `DataTable` con `createDataTableColumnHelper<CategoryDto>()`:
  columnas nombre+slug, descripción, estado (`Badge`), fecha de creación y acciones ·
  archivo: `src/modules/categories/components/category-table.tsx` · verificación:
  `npm run typecheck && npm run lint`
- [x] **T16** — Diálogo de alta y edición con React Hook Form + `zodResolver`, sugerencia
  de slug desde el nombre en creación y `Checkbox` para `isActive` · archivo:
  `src/modules/categories/components/category-form-dialog.tsx` · verificación:
  `npm run typecheck && npm run lint`
- [x] **T17** — `AlertDialog` de confirmación de borrado que muestra el error del
  servidor dentro del diálogo · archivo:
  `src/modules/categories/components/category-delete-dialog.tsx` · verificación:
  `npm run typecheck && npm run lint`
- [x] **T18** — Componente contenedor que compone filtros, tabla, paginación y diálogos, y
  mantiene la selección · archivo:
  `src/modules/categories/components/category-manager.tsx` · verificación:
  `npm run typecheck && npm run lint`
- [x] **T19** — Página fina con `metadata`, encabezado en español y `<Suspense>` ·
  archivo: `src/app/(admin)/admin/categories/page.tsx` · verificación: `npm run build`
- [x] **T20** — Añadir `{ href: "/admin/categories", label: "Categorías" }` a `NAV_ITEMS`
  sin tocar el guard · archivo: `src/app/(admin)/admin/layout.tsx` · verificación:
  `npm run typecheck`

### F4 — Cierre

- [x] **T21** — Verificación final: `typecheck`/`lint`/`build` en verde, repaso por código
  de AC1–AC4, AC7, AC12–AC14 y ejecución en runtime contra Neon de AC5, AC6, AC8, AC9,
  AC10 y AC11 con un script temporal ya eliminado (detalle en §4, "Cómo se verificó cada
  AC") · verificación: `npm run typecheck && npm run lint && npm run build`

## 10. Riesgos y consideraciones

- **[Alto] Los endpoints de categorías quedan abiertos a cualquier sesión autenticada
  (D2).** `src/middleware.ts` solo autentica en el borde y los handlers no verifican
  permiso: un `customer` del storefront con sesión válida puede listar, crear, editar y
  **borrar** categorías llamando directo a `/api/admin/categories`. La UI está protegida
  por `requireAdmin()` del layout, pero la API no lo está. El daño está acotado (los
  datos son taxonomía pública, no PII, y toda mutación queda auditada con su actor), pero
  el hueco es real y no debe salir a producción sin cerrarse. Se retoma en §11.
- **El buscador hace `seq scan`.** `ilike(name, '%term%')` no puede usar
  `categories_name_idx`, que es un btree. Irrelevante con decenas o cientos de
  categorías; si la tabla creciera, la solución es `pg_trgm` + índice GIN, no un índice
  más. Se documenta para que nadie asuma que el índice de `name` acelera la búsqueda.
- **Borrado sin guard de productos asociados.** En esta fase no existe `products`, así
  que borrar una categoría no puede dejar nada huérfano. **Cuando el spec de `products`
  introduzca `products.category_id`, este `DELETE` se vuelve peligroso**: hay que decidir
  ahí la política de FK (`ON DELETE RESTRICT` es lo esperable) y añadir en
  `deleteCategory` un `countProducts(id) > 0 → ConflictError`, igual que `deleteRole`
  hace con los usuarios asignados. Es la primera tarea de esa fase, no una mejora
  opcional.
- **Carrera en el slug único.** Dos altas simultáneas con el mismo slug: el pre-chequeo
  pasa en ambas y una revienta contra el índice. Mitigado por D4 (traducción del `23505`
  a 409). Sin D4 sería un 500. **Detalle verificado en runtime:** Drizzle 0.45 envuelve el
  error del driver en un `DrizzleQueryError` que no expone `code` en el nivel superior; el
  `23505` real está en `error.cause`. Por eso `isUniqueViolation()` recorre la cadena de
  `cause` en lugar de mirar solo el objeto lanzado. Cualquier futura traducción de códigos
  de Postgres en este proyecto tiene que hacer lo mismo.
- **Un fallo al escribir `audit_logs` aborta igualmente la mutación.** `logAudit`
  (`src/lib/audit.ts:135`) captura el error para las acciones no-seguras —y
  `category.*` no está en `SECURITY_ACTION_PREFIXES`— pero en Postgres un `INSERT`
  fallido deja la transacción en estado abortado: capturarlo en JavaScript no la
  recupera y el `COMMIT` fallará de todos modos. En la práctica, para categorías, el
  comportamiento efectivo es el de una auditoría bloqueante. Es un comportamiento
  heredado del helper compartido; **no se corrige en este spec**, se deja anotado para
  quien revise `lib/audit.ts`.
- **Editar el slug rompe URLs.** Cuando el storefront exponga `/products?category=<slug>`
  o `/categories/<slug>`, cambiar un slug invalidará enlaces externos e índices de
  buscadores sin dejar redirección. Aceptado en Fase 1 (no hay storefront). Cuando lo
  haya, o se congela el slug o se añade una tabla de redirecciones.
- **Sin recuperación tras el borrado (D3).** El borrado es físico e irreversible desde la
  UI; solo queda la traza en `audit_logs`. Mitigación de producto: el diálogo de
  confirmación debe sugerir desactivar (`isActive = false`) como alternativa.
- **`count(*)` + `offset` en cada página.** Coste despreciable para el volumen esperado de
  categorías; se menciona solo para que no se copie el patrón a `products` u `orders` sin
  pensar.
- **Sincronización URL ⇄ estado del buscador.** El input mantiene estado local (D6); si
  la URL cambia por fuera (botón atrás), hay que reflejarlo sin crear un bucle de
  actualización. Punto concreto a mirar en la revisión de T14.
- **Colisión de nombres de archivo.** `src/modules/categories/services/category.service.ts`
  (axios, cliente) y `src/server/services/category.service.ts` (dominio, servidor) se
  llaman igual. Es el mismo patrón que ya existe en el repositorio y los imports son por
  alias absoluto, pero es una fuente conocida de confusión al leer diffs.
- **La lista plana es una asunción (D1).** Si el negocio necesita subcategorías, cambiarlo
  después implica migración de datos, un formulario distinto y una tabla con expansión de
  filas. Corregirlo ahora es gratis; después, no.

## 11. Fuera de alcance / deuda aceptada

- **Autorización granular de categorías (D2) — la deuda principal de este spec.** Falta:
  añadir `CATEGORIES_READ`, `CATEGORIES_CREATE`, `CATEGORIES_UPDATE` y
  `CATEGORIES_DELETE` a `src/lib/permissions.catalog.ts`, sembrarlos en `db:seed`,
  asignarlos a los roles de sistema y sustituir `requireAuth()` por
  `requirePermission(PERMISSIONS.CATEGORIES_*)` en los cinco handlers. Es un cambio de
  cinco líneas por handler más el seed. **Se retoma en la fase de `products`**, que ya
  tocará el catálogo de permisos, y en todo caso **antes de dar acceso al panel a
  cualquier rol distinto de `admin`** o de publicar en producción. Hasta entonces, el
  proyecto está en violación consciente de CLAUDE.md §4 regla 8.
  **La Enmienda 1 (§12) agranda esta deuda**: a la falta de permiso granular se le suma
  la falta de autenticación. Deuda consolidada y plan de cierre en §12.11.
- **Jerarquía de categorías** (`parentId`, subcategorías, breadcrumb). Se retoma si el
  catálogo real supera los dos niveles de navegación.
- **Relación con `products`**: FK `products.category_id`, `relations()` en el schema,
  contador de productos por categoría en la tabla y guard de borrado. Todo ello pertenece
  al spec de `products`.
- **API pública `/api/categories`** para el storefront. `src/middleware.ts:11` ya la
  declara pública; el handler se escribe cuando exista una vista de cliente que lo
  consuma.
- **Orden manual (`sortOrder`) e imagen de portada.** Se retoma cuando diseño defina la
  navegación del storefront.
- **Ordenamiento por columna en la tabla.** Requiere habilitar features en el `DataTable`
  compartido y propagar `sort`/`order` a la query; es un cambio transversal que afectaría
  también a `audit-logs`. Se retoma cuando una segunda vista lo pida.
- **Soft delete de categorías (D3).** Se retoma solo si aparece un caso real de borrado
  accidental con impacto.
- **Tests automatizados.** El proyecto sigue sin runner (deuda heredada del spec 001). La
  verificación de cada tarea es `typecheck`/`lint`/`build` más el repaso manual de los AC.
- **Seed de categorías de ejemplo.** Se retoma junto con el seed de productos, que es
  quien lo necesita para tener datos coherentes.

---

## 12. Enmienda 1 — Acceso sin autenticación a `/admin/categories`

`status: done` · añadida el 2026-08-29 · aprobada e **implementada** el 2026-08-31 · **revisada y aprobada** el 2026-08-31

### 12.1 Contexto

Petición literal del usuario:

> «lo que quiero es que cuando esté en http://localhost:3000/admin/categories pueda ver
> las categorías, para poder crear, eliminar, modificar, etc. sin necesidad de
> registrarse porque un registrado es solo un usuario que no tiene acceso a lo que hace
> el admin»

La Fase 1 dejó los cinco Route Handlers sin `requirePermission()` (D2), pero **sí** con
`requireAuth()`, y la página sigue colgando del layout que exige sesión. Verificado hoy
en el repositorio:

- `src/app/(admin)/admin/layout.tsx:18` llama `await requireAdmin()` para **todo** el
  subárbol `(admin)/admin/*`, y `requireAdmin()` (`src/lib/auth.ts:28`) es
  `requirePermission(PERMISSIONS.ADMIN_ACCESS)`: exige sesión Clerk **y** una fila en
  `users` con el permiso `admin.access`.
- `src/middleware.ts:19` declara `isAdminRoute = ["/admin(.*)", "/api/admin(.*)"]` y la
  línea 26 (`if (isPublicRoute(req) && !isAdminRoute(req)) return;`) garantiza que el
  panel **nunca** pueda volverse público por un descuido en `isPublicRoute`.
- Los cinco handlers de `/api/admin/categories` llaman `requireAuth()`
  (`route.ts:16,35` y `[id]/route.ts:21,34,47`), que lanza 401 si no hay usuario local.
- `.env.local` tiene 8 variables y **ninguna** es el signing secret del webhook
  (verificado: solo `DATABASE_URL`, las cuatro de Clerk de cliente/servidor,
  `NEXT_PUBLIC_APP_URL` y los dos fallback redirects). `verifyWebhook()`
  (`src/app/api/webhooks/clerk/route.ts:26`) no puede validar firma sin él, así que
  `users` no se sincroniza y, según el diagnóstico previo, está vacía.

Consecuencia: hoy **nadie** puede entrar a `/admin/categories`. Ni siquiera creando una
cuenta en Clerk, porque no habría fila en `users` ni permiso `admin.access`. Las
alternativas eran configurar el webhook y sembrar un admin, o quitar la autenticación de
esa ruta. El usuario eligió lo segundo para poder trabajar en local.

### 12.2 Objetivo

Cualquier visitante, sin sesión, puede listar, crear, editar y eliminar categorías en
`/admin/categories` y en `/api/admin/categories/*`, mientras `/admin`, `/admin/roles` y
`/admin/audit-logs` —y sus APIs— conservan **exactamente** la protección que tienen hoy.

### 12.3 Alcance

#### Incluye

- Sacar `/admin/categories` del subárbol que ejecuta `requireAdmin()`, sin modificar el
  guard que protege al resto del panel (D14).
- Exceptuar `/admin/categories` y `/api/admin/categories/*` del trato incondicional de
  `isAdminRoute` en `src/middleware.ts` (D16).
- Sustituir `requireAuth()` por `getCurrentUser()` en los cinco handlers de categorías y
  admitir un actor nulo en `src/server/services/category.service.ts` (D17).
- Extraer el chrome del panel (sidebar + `NAV_ITEMS`) a un componente compartido para no
  duplicarlo entre los dos layouts (D15).
- Mantener la auditoría de las tres mutaciones, con actor nulo cuando no hay sesión
  (CLAUDE.md §4 regla 9 sigue vigente y no se toca).

#### No incluye (explícito)

- **Cualquier cambio en `/admin/roles`, `/admin/audit-logs`, `/admin` (dashboard) o sus
  endpoints.** El spec 001 no se reabre (D13).
- Configurar `CLERK_WEBHOOK_SIGNING_SECRET`, arreglar la sincronización de `users` ni
  sembrar un usuario admin. Es la alternativa que el usuario descartó.
- Quitar `ClerkProvider`, el `middleware.ts` o los componentes de sign-in/sign-up. Clerk
  se queda: la exención es por ruta, no global.
- Añadir permisos `categories.*` (sigue pendiente de la Fase de `products`, §11).
- Cambios en el modelo de datos, en los schemas Zod, en el repositorio, en los hooks o
  en los componentes de `src/modules/categories/`.
- Rate limiting o cualquier otra mitigación del endpoint anónimo (§12.10).
- Despliegue. Esta enmienda describe una configuración **de desarrollo local**.

### 12.4 Criterios de aceptación

- [x] **AC16** — Dado un visitante sin sesión, cuando abre `/admin/categories`, entonces
  ve la tabla de categorías con su sidebar y **no** es redirigido a `/sign-in`.
- [x] **AC17** — Dado un visitante sin sesión, cuando llama `GET /api/admin/categories`,
  entonces recibe 200 con `{ data, meta }` en lugar del 401 actual.
- [x] **AC18** — Dado un visitante sin sesión, cuando crea, edita y borra una categoría
  desde la UI, entonces las tres operaciones responden 201/200/204 y dejan sus filas en
  `audit_logs` con `actor_id = NULL` y `metadata = {"anonymousActor": true}`.
- [x] **AC19** — Dada esa fila de bitácora, cuando un admin abre `/admin/audit-logs`,
  entonces la columna Actor muestra `Sistema` y el detalle también, sin código nuevo
  (ya resuelto en `audit-log-table.tsx:76` y `audit-log-detail-sheet.tsx:62`).
- [x] **AC20** — Dado un visitante sin sesión, cuando abre `/admin`, `/admin/roles` o
  `/admin/audit-logs`, entonces sigue siendo redirigido a `/sign-in` exactamente como
  hoy.
- [x] **AC21** — Dado un visitante sin sesión, cuando llama `GET /api/admin/roles`,
  `/api/admin/users`, `/api/admin/permissions` o `/api/admin/audit-logs`, entonces sigue
  recibiendo 401 con el envelope de `src/lib/api-error.ts`.
- [x] **AC22** — Dado un usuario **con** sesión Clerk y fila en `users`, cuando muta una
  categoría, entonces `audit_logs.actor_id` es su id y `metadata` es `null`. *(No
  verificable en runtime hasta que el webhook sincronice `users`; se comprueba por
  código.)*
- [x] **AC23** — Dada la validación Zod, cuando llega un payload inválido a cualquier
  handler de categorías, entonces sigue devolviendo 400 `VALIDATION_ERROR`: quitar la
  autenticación no relaja ninguna validación (AC7 y AC12 siguen vigentes).
- [x] **AC24** — `npm run typecheck && npm run lint && npm run build` en verde, sin rutas
  duplicadas entre los dos grupos de rutas.

#### Cómo se verificó cada AC de la enmienda

**En runtime, con `npm run dev` y `curl` sin cookies** (sesión anónima real):

- **AC16** — `GET /admin/categories` → `200`, sin `Location`. El HTML servido contiene
  `Administración`, `Dashboard`, `Roles y accesos`, `Bitácora` (sidebar de `AdminShell`)
  y `Taxonomía del catálogo` (encabezado de la página).
- **AC17** — `GET /api/admin/categories` → `200` con
  `{"data":[],"meta":{"page":1,"pageSize":20,"total":0}}`.
- **AC18** — Ciclo completo anónimo: `POST` → `201`, `PATCH` → `200`, `DELETE` → `204`.
  Consulta directa a Neon sobre `audit_logs where entity_type='category'`: las tres filas
  (`category.created`, `category.updated`, `category.deleted`) con `actor_id = null` y
  `metadata = {"anonymousActor": true}`. `category.updated` trae en `changes` **solo**
  `description` (AC8 sigue vigente) y `category.deleted` tiene `severity = "warning"`
  con el registro anterior en `changes.before` (AC10 sigue vigente). El `DELETE` repetido
  devolvió `404` (AC11 sigue vigente). `categories` quedó de nuevo en 0; las tres filas de
  bitácora **se conservan a propósito** —`audit_logs` es append-only— y sirven para
  comprobar AC19 en la UI.
- **AC20** — `/admin`, `/admin/roles` y `/admin/audit-logs` → `307` a
  `/sign-in?redirect_url=…`, idéntico a antes.
- **AC21** — `/api/admin/roles`, `/api/admin/users`, `/api/admin/permissions` y
  `/api/admin/audit-logs` → `401` con
  `{"error":{"code":"UNAUTHORIZED","message":"No autenticado.","details":null}}`.
- **AC23** — `POST` con `{"name":"","slug":"Con Mayus"}` → `400 VALIDATION_ERROR` con los
  dos issues de Zod; `GET /api/admin/categories/no-es-uuid` → `400 VALIDATION_ERROR`.
- **Precisión del matcher (D16, riesgo de §12.10)** — comprobado además que los prefijos
  vecinos **no** heredan la exención: `/admin/categories-internas` → `307` a `/sign-in` y
  `/api/admin/categoriesX` → `401`.

**Por código**, no ejercitados en runtime:

- **AC19** — `getCurrentUser()` devuelve `null` mientras `users` no se sincronice, así que
  no hay sesión con la que abrir `/admin/audit-logs`. Verificado en
  `audit-log-table.tsx:76` (`<span …>Sistema</span>` para actor nulo) y
  `audit-log-detail-sheet.tsx:62` (`log.actor?.email ?? "Sistema"`). Ninguno de los dos
  archivos se tocó.
- **AC22** — Mismo bloqueo (webhook sin signing secret). Verificado en
  `category.service.ts`: con `actor` no nulo se escribe `actorId: actor.id` y
  `actorMetadata(actor)` devuelve `null`.
- **AC24** — `npm run typecheck && npm run lint && npm run build` en verde. El listado de
  rutas del build muestra `/admin/categories` **una sola vez**: los dos grupos no colisionan.
  Nota: la ruta pasa de `ƒ (Dynamic)` a `○ (Static)` porque su layout ya no ejecuta el
  guard asíncrono; los datos los sigue trayendo TanStack Query en cliente.
- **Incidencia durante T29**: el primer `typecheck`/`build` tras mover la página falló con
  `TS2307` en `.next/dev/types/validator.ts`, que aún referenciaba
  `(admin)/admin/categories/page.js`. Es un artefacto generado por un `next dev` anterior e
  incluido por `tsconfig.json` (`.next/dev/types/**/*.ts`); se borró `.next/dev` y se
  regeneró limpio. No hubo cambio de código por esto.

### 12.5 Modelo de datos

**Sin cambios de esquema.** No hay migración. `audit_logs.actor_id` ya es nullable
(`uuid("actor_id").references(() => users.id, { onDelete: "set null" })`,
`src/server/db/schema/audit-log.ts:21`) y `AuditEntry.actorId` ya está tipado
`string | null` (`src/lib/audit.ts:30`), así que un actor ausente cabe en el modelo
actual sin tocarlo.

### 12.6 Contratos de API

Las rutas, los payloads y los códigos de éxito no cambian. Cambia la columna **Auth** y
desaparece el 401.

| Método | Ruta | Auth (antes → después) | Errores (antes → después) |
|---|---|---|---|
| GET | `/api/admin/categories` | sesión autenticada → **sin autenticación** | 400, 401, 500 → 400, 500 |
| POST | `/api/admin/categories` | sesión autenticada → **sin autenticación** | 400, 401, 409, 500 → 400, 409, 500 |
| GET | `/api/admin/categories/[id]` | sesión autenticada → **sin autenticación** | 400, 401, 404, 500 → 400, 404, 500 |
| PATCH | `/api/admin/categories/[id]` | sesión autenticada → **sin autenticación** | 400, 401, 404, 409, 500 → 400, 404, 409, 500 |
| DELETE | `/api/admin/categories/[id]` | sesión autenticada → **sin autenticación** | 400, 401, 404, 500 → 400, 404, 500 |

El resto de `/api/admin/*` mantiene su contrato íntegro, incluido el 401 del borde y el
403 de `requirePermission()`.

**Sin cambios en los schemas Zod.** `category.schema.ts` no se toca: la entrada se sigue
validando igual (AC23).

Firmas afectadas en el servidor:

```ts
// src/server/services/category.service.ts — actor opcional
export async function createCategory(actor: User | null, input: CreateCategoryInput): Promise<Category>
export async function updateCategory(actor: User | null, id: string, input: UpdateCategoryInput): Promise<Category>
export async function deleteCategory(actor: User | null, id: string): Promise<void>
```

### 12.7 Arquitectura y archivos afectados

Árbol actual verificado (`src/app/`): el grupo `(admin)` contiene un único layout,
`(admin)/admin/layout.tsx`, del que cuelgan `page.tsx` (dashboard), `categories/`,
`roles/` y `audit-logs/`. No hay layouts intermedios.

Árbol propuesto:

```
src/app/
├── (admin)/admin/               ← guard requireAdmin() INTACTO
│   ├── layout.tsx               ← modificado: delega el chrome en <AdminShell>
│   ├── page.tsx                 ← sin cambios
│   ├── roles/page.tsx           ← sin cambios
│   └── audit-logs/page.tsx      ← sin cambios
└── (admin-public)/admin/categories/   ← grupo nuevo, sin guard
    ├── layout.tsx               ← nuevo: solo <AdminShell>, sin requireAdmin()
    └── page.tsx                 ← movido, contenido idéntico
```

Los grupos de rutas no aparecen en la URL, así que `/admin/categories` sigue siendo
`/admin/categories`. Next solo falla si dos grupos resuelven la **misma** ruta, y aquí
las rutas son disjuntas (T29 lo verifica con `npm run build`).

Capa por capa:

- `src/server/services/category.service.ts` — **modificado**: `actor: User | null` en las
  tres funciones, `actorId: actor?.id ?? null` y `metadata` marcando el actor anónimo.
- `src/app/api/admin/categories/route.ts` — **modificado**: fuera `requireAuth`; `GET`
  sin llamada de auth, `POST` con `getCurrentUser()`.
- `src/app/api/admin/categories/[id]/route.ts` — **modificado**: igual en `GET`, `PATCH`
  y `DELETE`.
- `src/middleware.ts` — **modificado**: matcher de excepción evaluado antes que todo lo
  demás.
- `src/components/shared/admin-shell.tsx` — **nuevo**: sidebar y `NAV_ITEMS`, sin lógica
  de auth. Vive junto a `header.tsx` y `data-table.tsx`, que ya están en esa carpeta.
- `src/app/(admin)/admin/layout.tsx` — **modificado**: conserva `resolveAccess()`,
  `requireAdmin()` y los dos `redirect()` tal cual; solo sustituye el markup del sidebar
  por `<AdminShell>`.
- `src/app/(admin-public)/admin/categories/layout.tsx` — **nuevo**.
- `src/app/(admin-public)/admin/categories/page.tsx` — **movido** desde
  `(admin)/admin/categories/page.tsx`, byte por byte.
- `src/modules/categories/**` — **sin cambios**. Ni hooks, ni services de axios, ni
  componentes, ni schemas.
- `src/lib/auth.ts` — **sin cambios**. `requireAuth()` sigue existiendo porque
  `src/lib/permissions.ts:41` lo usa; solo dejan de llamarlo los handlers de categorías
  (verificado: no hay otro consumidor).
- `src/server/repositories/category.repository.ts` y el schema — **sin cambios**.

### 12.8 Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **D13** — **Opción A: la exención cubre solo `/admin/categories` y `/api/admin/categories/*`.** `/admin`, `/admin/roles`, `/admin/audit-logs` y todos los demás endpoints de `/api/admin/*` quedan **igual que hoy**. | **Opción B: abrir todo `/admin` y todo `/api/admin`.** | Es la decisión que esta enmienda fuerza y la que se somete a aprobación. El usuario pidió categorías, no el panel entero. La Opción B reabriría el spec 001 —ya `done`— y dejaría a cualquier visitante crear roles, asignarse permisos y **leer la bitácora completa, que contiene emails de usuarios e IPs**: eso sí es PII, y CLAUDE.md §4 regla 9 la protege explícitamente. La Opción A deja abierto un dato público (la taxonomía del catálogo). Si el usuario quiere B, tiene que decirlo al aprobar; no se implementa por defecto. |
| **D14** — Grupo de rutas hermano `(admin-public)/admin/categories/` con layout propio sin guard. El layout `(admin)/admin/layout.tsx` **conserva su `requireAdmin()` sin tocar**. | (a) Añadir `categories/layout.tsx` dentro de `(admin)/admin/`. (b) Mover el guard a un grupo interno `(protected)` y quitarlo del layout compartido. (c) Guard opt-in llamando `requireAdmin()` en cada página protegida. | (a) **No funciona**: en App Router los layouts se **componen**; un layout hijo no anula al padre, `(admin)/admin/layout.tsx` seguiría ejecutando `requireAdmin()` antes de renderizar la página. (b) y (c) funcionan, pero ambas **desprotegen primero y reprotegen después** las tres rutas del spec 001: cualquier error en esa reescritura las deja abiertas, que es justo lo que esta enmienda promete no hacer. Con el grupo hermano, el guard existente no se modifica en ninguna línea: `/admin/categories` simplemente deja de pasar por él. Además (c) duplicaría el bloque `resolveAccess` + `redirect` en tres archivos y es fail-open para toda página nueva. Coste asumido: la barra lateral se remonta al navegar entre `/admin/categories` y el resto (dos árboles de layout distintos); es markup estático, no se percibe. |
| **D15** — Extraer el sidebar y `NAV_ITEMS` a `src/components/shared/admin-shell.tsx`, consumido por los dos layouts. | Copiar el `<aside>` y el array `NAV_ITEMS` en el layout nuevo. | Duplicar `NAV_ITEMS` garantiza que el menú se desincronice en el primer cambio. No es una abstracción prematura (CLAUDE.md §6): nace con dos consumidores reales y una sola responsabilidad, presentar el chrome del panel. El componente **no** hace ninguna comprobación de auth; quién puede entrar lo decide cada layout. |
| **D16** — En `src/middleware.ts`, un matcher de excepción evaluado **antes** de todo lo demás, con rutas exactas: `"/admin/categories"`, `"/admin/categories/(.*)"`, `"/api/admin/categories"`, `"/api/admin/categories/(.*)"`. | (a) Añadir `"/admin/categories(.*)"` a `isPublicRoute` y negar la excepción dentro de `isAdminRoute`. (b) Usar el sufijo `(.*)` pegado al nombre: `"/admin/categories(.*)"`. | (a) obligaría a reescribir `isAdminRoute`, la línea que garantiza que el panel no se abra por descuido; se prefiere no tocarla. Una excepción explícita y nombrada se lee mejor y es un `git blame` de una sola línea. (b) `"/admin/categories(.*)"` también casaría con `/admin/categories-internas` o `/api/admin/categoriesX`: la forma con `/` explícito no filtra a prefijos vecinos. La skill `clerk-nextjs-patterns` (referencia *middleware-strategies*) confirma que exceptuar rutas concretas dentro de `clerkMiddleware` es el patrón soportado —es el modelo "public-first"—, y no exige `auth.protect()` para que el resto siga protegido. |
| **D17** — Actor de auditoría opcional: los handlers usan `getCurrentUser()` (devuelve `User \| null`), el servicio acepta `User \| null` y escribe `actorId: actor?.id ?? null` más `metadata: actor ? null : { anonymousActor: true }`. | (a) Mantener `requireAuth()`. (b) Sembrar un usuario "sistema" en `users` y usarlo como actor. (c) Omitir `logAudit` cuando no hay actor. | (a) contradice el objetivo: es exactamente el 401 que hay que quitar. (b) exige un seed nuevo y mete una fila fantasma con un email falso en la tabla de usuarios reales, que además aparecería como actor en la bitácora. (c) viola CLAUDE.md §4 regla 9, que no se relaja aquí. El `metadata` no es adorno: `actor_id` nulo **ya tiene otro significado** en este esquema —`onDelete: "set null"` lo pone a null cuando se borra el usuario—, así que sin la marca no se distingue «lo hizo alguien que ya no existe» de «no había sesión». Con sesión válida el actor se sigue registrando: la enmienda no ciega la bitácora, la degrada solo cuando no hay a quién atribuir. |
| **D18** — `getCurrentUser()` se sigue usando dentro de rutas exentas, sin envolverlo en try/catch. | Leer la sesión con `auth()` a pelo en el handler o asumir que sin middleware protector no hay sesión disponible. | `clerkMiddleware` **se ejecuta igual** en las rutas exentas: el `return` temprano solo omite la exigencia de sesión, no desactiva el contexto de Clerk, así que `auth()` sigue resolviendo dentro del handler (patrón "public-first" de `clerk-nextjs-patterns`). `getCurrentUser()` (`src/lib/auth.ts:13`) ya devuelve `null` cuando no hay `userId` **y** cuando el `userId` no tiene espejo en `users` —el caso real de hoy—, sin lanzar. Es el helper correcto y ya está cacheado por request. |

**Skills.** Instaladas en esta sesión y usadas: `clerk-nextjs-patterns` (fundamenta D16
y D18; su referencia *middleware-strategies* documenta el modelo public-first) y
`security-review` (aplicable sobre el diff, no sobre un spec: **debe ejecutarla el
reviewer** tras implementar, con foco en D13 y en §12.10). **No** están instaladas
`superpowers:brainstorming`, `superpowers:writing-plans`, `vercel:nextjs`,
`vercel:next-cache-components` ni `vercel:vercel-storage`; se procedió sin ellas y todo
lo afirmado sobre el código se verificó leyendo los archivos citados con línea.

### 12.9 Tareas

Ordenadas por dependencia: primero el servidor (para que el tipo del actor se relaje
antes de que los handlers dejen de garantizarlo), luego el borde, luego la UI.

- [x] **T22** — Aceptar actor nulo en las tres funciones (`actor: User | null`,
  `actorId: actor?.id ?? null`, `metadata: actor ? null : { anonymousActor: true }`) ·
  archivo: `src/server/services/category.service.ts` · verificación: `npm run typecheck`
- [x] **T23** — Quitar `requireAuth()` del handler de colección: `GET` sin llamada de
  auth y `POST` con `const actor = await getCurrentUser()` · archivo:
  `src/app/api/admin/categories/route.ts` · verificación:
  `npm run typecheck && npm run lint`
- [x] **T24** — Lo mismo en el handler de recurso, en `GET`, `PATCH` y `DELETE`,
  conservando `resolveId()` y el manejo de errores · archivo:
  `src/app/api/admin/categories/[id]/route.ts` · verificación:
  `npm run typecheck && npm run lint`
- [x] **T25** — Añadir el matcher de excepción con las cuatro rutas exactas de D16 y
  evaluarlo como primer `return` del callback, sin modificar `isPublicRoute`,
  `isAdminRoute`, `isApiRoute` ni `config.matcher` · archivo: `src/middleware.ts` ·
  verificación: `npm run typecheck && npm run lint`
- [x] **T26** — Crear el componente de chrome del panel con el `<aside>` y los cuatro
  `NAV_ITEMS` actuales, sin ninguna lógica de auth y sin `"use client"` · archivo:
  `src/components/shared/admin-shell.tsx` · verificación: `npm run typecheck`
- [x] **T27** — Sustituir el markup del sidebar por `<AdminShell>` dejando
  `resolveAccess()`, `requireAdmin()` y los dos `redirect()` **sin un solo cambio** ·
  archivo: `src/app/(admin)/admin/layout.tsx` · verificación: `npm run typecheck`
- [x] **T28** — Crear el layout sin guard del grupo nuevo: solo `<AdminShell>`, tipando
  las props como `{ children: ReactNode }` igual que `src/app/(storefront)/layout.tsx` ·
  archivo: `src/app/(admin-public)/admin/categories/layout.tsx` · verificación:
  `npm run typecheck`
- [x] **T29** — Mover la página al grupo nuevo con su contenido idéntico y borrar el
  directorio `src/app/(admin)/admin/categories/`, que queda vacío · archivo:
  `src/app/(admin-public)/admin/categories/page.tsx` · verificación: `npm run build`
  (falla si quedan dos rutas resolviendo `/admin/categories`)
- [x] **T30** — Verificación final en runtime con `npm run dev` y el navegador en sesión
  anónima: AC16–AC18 y AC20–AC21 (incluido `curl` sin cookies a
  `/api/admin/categories` esperando 200 y a `/api/admin/roles` esperando 401), más
  consulta a `audit_logs` confirmando `actor_id IS NULL` y el `metadata` de AC18 ·
  verificación: `npm run typecheck && npm run lint && npm run build`

### 12.10 Riesgos y consideraciones

- **[Crítico] El CRUD de categorías queda expuesto a cualquiera que conozca la URL.**
  Antes del cambio el hueco era «cualquier usuario autenticado» (§10); después es
  «cualquiera, sin cuenta». Un `DELETE` anónimo puede vaciar la taxonomía del catálogo y
  la bitácora no podrá decir quién fue: solo quedará una IP y un user-agent. **Esto es
  aceptable únicamente en `localhost` durante esta fase.** Desplegar el proyecto con esta
  enmienda activa es un incidente de seguridad, no un bug. Plan de cierre en §12.11.
- **Sin autenticación no hay rate limiting de ningún tipo.** El proyecto no tiene ninguno
  y hasta ahora la sesión hacía de freno natural. `POST /api/admin/categories` pasa a ser
  un endpoint de escritura anónimo: un bucle trivial llena la tabla y la bitácora. No se
  mitiga en esta enmienda; se documenta.
- **Fuga de precisión en el matcher.** Si alguien "simplifica" las cuatro rutas de D16 a
  `"/admin/categories(.*)"`, cualquier ruta futura con ese prefijo hereda la exención sin
  que nadie lo note. Punto explícito a revisar en T25.
- **`(admin-public)` puede convertirse en cajón de sastre.** El grupo debe contener
  exclusivamente `admin/categories`. Añadir ahí otra página es abrir otra ruta al público
  sin discutirlo. Si aparece una segunda, se revisa la decisión, no se copia el patrón.
- **La sidebar mostrará enlaces a Roles y Bitácora a un visitante anónimo**, que al
  pulsarlos irá a `/sign-in`. Es la consecuencia de reutilizar el chrome (D15). Ocultar
  esos enlaces exigiría consultar la sesión dentro de `AdminShell` y volvería a acoplar
  el componente a la auth: se acepta el enlace muerto. Si molesta, es una tarea de UI
  aparte.
- **Regresión silenciosa del guard.** T27 toca el archivo que protege el spec 001. La
  revisión debe comprobar por diff que `resolveAccess`, `requireAdmin()` y los dos
  `redirect()` siguen idénticos; AC20 y AC21 lo verifican en runtime.
- **`getCurrentUser()` devuelve `null` incluso con sesión Clerk válida** mientras `users`
  no se sincronice. En la práctica, hoy **todas** las mutaciones de categorías quedarán
  con `actor_id = NULL`, tenga o no sesión quien las haga. AC22 no será observable hasta
  que se configure el webhook.
- **La bitácora de categorías pierde valor forense.** Sigue registrando qué cambió y
  cuándo, pero el «quién» se vuelve `Sistema` para todo el mundo. Quien audite estos datos
  debe saberlo; por eso el `metadata` de D17 distingue el caso.
- **`src/middleware.ts` en Next.js 16.3.3.** La skill `clerk-nextjs-patterns` indica que
  a partir de Next 16 el archivo se llama `proxy.ts`. El proyecto usa `middleware.ts` y
  funciona; renombrarlo es deuda ajena a esta enmienda y **no se hace aquí** (cambiar el
  archivo que protege el panel y su contenido a la vez multiplica el riesgo por nada).
- **Reversión.** Volver atrás es exacto y barato: revertir T22–T29. Reactivar la
  protección de verdad, en cambio, exige antes configurar el signing secret del webhook y
  sembrar un admin, o el panel se queda otra vez sin nadie que pueda entrar. Ese orden
  importa.

### 12.11 Fuera de alcance / deuda aceptada

- **Deuda consolidada de categorías (§11 + esta enmienda).** `/admin/categories` y su API
  quedan sin **autenticación** (Enmienda 1) y sin **autorización** (D2). El cierre
  completo, cuando toque, es: (1) configurar `CLERK_WEBHOOK_SIGNING_SECRET` y verificar
  que el webhook sincroniza `users`; (2) sembrar un usuario con el rol admin y el permiso
  `admin.access`; (3) revertir T22–T29 para devolver `/admin/categories` bajo el guard;
  (4) añadir `CATEGORIES_READ/CREATE/UPDATE/DELETE` a `permissions.catalog.ts` y
  sustituir la llamada de auth por `requirePermission()` en los cinco handlers. Los pasos
  1 y 2 son requisito de los pasos 3 y 4: sin ellos nadie podría volver a entrar al
  panel. **Es condición de salida obligatoria antes de cualquier despliegue**, y hasta
  entonces el proyecto está en violación consciente de CLAUDE.md §4 regla 8 y de
  `docs/SETUP.md` §6.
- **Sincronización de `users` con Clerk.** Sigue rota (falta el signing secret). Esta
  enmienda la esquiva, no la arregla.
- **Rate limiting y protección anti-abuso** de los endpoints anónimos. Se retoma con el
  punto anterior, no antes.
- **Ocultar los enlaces del sidebar según permisos.** Requiere un `AdminShell` consciente
  de la sesión; se retoma si el panel llega a tener roles con vistas parciales.
- **Renombrar `src/middleware.ts` a `proxy.ts`** (convención de Next.js 16). Deuda
  transversal, spec aparte.
- **Tests automatizados.** El proyecto sigue sin runner: AC16–AC24 se verifican a mano.
