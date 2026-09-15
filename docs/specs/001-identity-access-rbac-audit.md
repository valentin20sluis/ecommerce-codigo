---
id: 001
title: Identidad y acceso (RBAC) + Auditoría
status: done
module: shared
scope: both
created: 2026-08-28
---

# 001 — Identidad y acceso (RBAC) + Auditoría

## 1. Contexto

El proyecto terminó el bootstrap: existen las dependencias, la estructura de carpetas
de `docs/SETUP.md` §3 y el cliente Drizzle, pero `src/server/db/schema/index.ts` es
`export {}` y no hay ninguna tabla. `src/middleware.ts` solo distingue rutas públicas
de protegidas, y `src/app/(admin)/admin/layout.tsx` es un `<div>` sin guard.

Esta es la primera feature de dominio y es fundacional: `products`, `orders` y
`customers` necesitan `users` para sus claves foráneas y `audit_logs` para trazar sus
mutaciones, y todo el panel admin necesita RBAC para autorizar. Sin ella no se puede
especificar ninguna otra feature sin inventar el modelo de identidad sobre la marcha.

Clerk es la fuente de verdad de la **autenticación**; Postgres lo es de la
**autorización** (`docs/SETUP.md` §5.1). Esta feature construye el puente entre ambos.

## 2. Objetivo

Un administrador puede componer roles a partir de permisos atómicos y asignarlos a
usuarios sincronizados desde Clerk, de modo que todo endpoint bajo `/api/admin/` se
autorice por **código de permiso** y toda mutación de seguridad quede registrada de
forma inmutable en `audit_logs`.

## 3. Alcance

### Incluye

- Tablas `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`
  y su migración Drizzle.
- Cliente Drizzle transaccional (`neon-serverless`) además del actual `neon-http`.
- Webhook de Clerk (`user.created`, `user.updated`, `user.deleted`) que sincroniza `users`.
- Resolución de permisos efectivos en servidor: `clerk_id → users → user_roles →
  role_permissions → permissions`.
- `src/lib/auth.ts`, `src/lib/permissions.ts`, `src/lib/audit.ts`, `src/lib/api-error.ts`.
- Guard de dos capas: `middleware.ts` (autenticación en el borde) + `requirePermission()`
  por código en cada Route Handler admin y en el layout de `/admin`.
- Seed idempotente del catálogo de `permissions` y de los roles de sistema
  (`customer`, `admin`, `manager`, `support`).
- API admin: roles (CRUD), permisos (lectura), matriz rol×permiso, asignación de roles a
  usuarios, listado de bitácora con filtros.
- UI admin: `/admin/roles` (tabla de roles, formulario, matriz de permisos, asignación a
  usuarios) y `/admin/audit-logs` (tabla filtrable).
- `src/components/shared/data-table.tsx` genérico sobre TanStack Table v9.

### No incluye (explícito)

- Provisionar el proyecto Neon y la aplicación Clerk reales (prerrequisito humano, F0).
- Tablas de catálogo y ventas (`products`, `orders`, …) — specs posteriores.
- Cachear el set de permisos en `publicMetadata` de Clerk (§5.1 lo marca opcional y
  derivado).
- UI de cliente para el storefront; esta feature no toca `(storefront)`.
- Job de purga por retención de `audit_logs` (§11).
- Multi-tenancy / organizaciones de Clerk.
- Escritura de `audit_logs` desde módulos aún inexistentes (products, orders); esta
  feature entrega el helper, no sus llamadores futuros.

## 4. Criterios de aceptación

- [ ] **AC1** — Dado un usuario que se registra en Clerk, cuando Clerk emite
  `user.created` al webhook, entonces existe una fila en `users` con ese `clerk_id`,
  el email primario y `is_active = true`.
- [ ] **AC2** — Dado un evento de webhook con firma inválida o ausente, cuando llega a
  `/api/webhooks/clerk`, entonces la respuesta es 400 y no se escribe nada en `users`.
- [ ] **AC3** — Dado un `user.created` reenviado por Clerk (reintento), cuando se procesa
  por segunda vez, entonces no se crea una fila duplicada y la respuesta sigue siendo 200.
- [ ] **AC4** — Dado un `user.deleted`, cuando se procesa, entonces la fila queda con
  `is_active = false` y `deleted_at` no nulo, y **no** se borra físicamente.
- [ ] **AC5** — Dado un usuario anónimo, cuando visita `/admin`, entonces es redirigido a
  `/sign-in`; y cuando llama `GET /api/admin/roles`, entonces recibe 401 en JSON.
- [ ] **AC6** — Dado un usuario autenticado sin el permiso `admin.access`, cuando visita
  `/admin`, entonces es redirigido a `/`; y cuando llama `GET /api/admin/roles`, entonces
  recibe 403.
- [ ] **AC7** — Dado un usuario sin filas en `user_roles`, cuando se resuelven sus
  permisos efectivos, entonces obtiene exactamente los del rol `customer`, sin que ese
  default esté escrito en más de un archivo.
- [ ] **AC8** — Dado `npm run db:seed` ejecutado dos veces seguidas, cuando termina la
  segunda corrida, entonces el número de filas de `permissions` y `roles` es idéntico al
  de la primera y ningún `role_permissions` quedó duplicado.
- [ ] **AC9** — Dado un admin que guarda la matriz de permisos de un rol, cuando la
  operación termina con éxito, entonces `role_permissions` refleja exactamente el set
  enviado y existe una fila en `audit_logs` con `action = 'role.permissions_changed'` y
  `changes = { before, after }`.
- [ ] **AC10** — Dado un fallo al escribir en `audit_logs` durante un cambio de permisos
  de rol, cuando la transacción se evalúa, entonces la mutación se revierte por completo
  y el endpoint responde 500.
- [ ] **AC11** — Dado un rol con `is_system = true`, cuando se intenta `DELETE`, entonces
  la respuesta es 409 y el rol permanece.
- [ ] **AC12** — Dado un rol con usuarios asignados, cuando se intenta `DELETE`, entonces
  la respuesta es 409 y no se pierde ninguna asignación.
- [ ] **AC13** — Dado un payload con un campo sensible (`password`, `token`, `secret`,
  `authorization`, `apiKey`, `card`, `cvv`) en `changes` o `metadata`, cuando `logAudit()`
  serializa, entonces ese valor aparece como `"[REDACTED]"` en la fila persistida.
- [ ] **AC14** — Dado un admin en `/admin/audit-logs`, cuando filtra por actor, entidad,
  acción, severidad y rango de fechas, entonces la tabla muestra solo las filas que
  cumplen **todos** los filtros, paginadas y ordenadas por `created_at` descendente.
- [x] **AC15** — Dado el código del proyecto, cuando se busca `role === 'admin'` o
  cualquier comparación por nombre de rol para autorizar, entonces no hay ninguna
  ocurrencia; toda verificación pasa por `requirePermission(PERMISSIONS.*)`.
- [x] **AC16** — Dado el repositorio de auditoría, cuando se inspecciona su superficie
  pública, entonces no expone ningún método de `update` ni `delete`.
- [x] **AC17** — `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

Seis tablas nuevas. **Requiere migración** (`npm run db:generate` + `npm run db:migrate`).
Hoy `drizzle/` no existe: esta feature genera la migración inicial.

Convención de `docs/SETUP.md` §3: un archivo por tabla, nombre singular en kebab-case,
tabla en snake_case plural. Los tipos se infieren con `InferSelectModel` / `InferInsertModel`
(regla dura 5 de §4); no se declaran a mano.

### 5.1 `users` — `src/server/db/schema/user.ts`

```ts
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_clerk_id_unique").on(t.clerkId),
    uniqueIndex("users_email_unique").on(t.email),
    index("users_is_active_idx").on(t.isActive),
  ],
);
```

`deletedAt` e `imageUrl` son adiciones sobre el mínimo de §5.1: la primera porque
`user.deleted` no puede hacer `DELETE` físico sin romper las FK de `audit_logs` y de los
futuros `orders`; la segunda porque la UI de asignación de roles lista usuarios con avatar
y `components/ui/avatar.tsx` ya está instalado.

### 5.2 `roles` — `src/server/db/schema/role.ts`

```ts
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("roles_slug_unique").on(t.slug)],
);
```

### 5.3 `permissions` — `src/server/db/schema/permission.ts`

```ts
export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),          // "<resource>.<action>"
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("permissions_code_unique").on(t.code),
    uniqueIndex("permissions_resource_action_unique").on(t.resource, t.action),
    index("permissions_resource_idx").on(t.resource),
  ],
);
```

### 5.4 `role_permissions` — `src/server/db/schema/role-permission.ts`

```ts
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index("role_permissions_permission_id_idx").on(t.permissionId),
  ],
);
```

### 5.5 `user_roles` — `src/server/db/schema/user-role.ts`

```ts
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("user_roles_role_id_idx").on(t.roleId),
  ],
);
```

`onDelete: "restrict"` sobre `roles` es deliberado: borrar un rol con usuarios asignados
los degradaría en silencio al default `customer`. La API responde 409 y obliga a
reasignar primero (AC12).

### 5.6 `audit_logs` — `src/server/db/schema/audit-log.ts`

Columnas exactamente como `docs/SETUP.md` §5.2.

```ts
export const auditSeverity = pgEnum("audit_severity", ["info", "warning", "error"]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    changes: jsonb("changes").$type<AuditChanges | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    severity: auditSeverity("severity").notNull().default("info"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_created_at_idx").on(t.actorId, desc(t.createdAt)),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_at_idx").on(desc(t.createdAt)),
  ],
);
```

`inet()` y `jsonb()` están disponibles en la versión instalada de `drizzle-orm`
(`0.45.2`); verificado en `node_modules/drizzle-orm/pg-core/columns/`.

### 5.7 Relaciones

Cada archivo declara su `relations()` junto a su tabla (una tabla, un archivo):
`users ↔ userRoles ↔ roles ↔ rolePermissions ↔ permissions`, y `auditLogs → users`
por `actorId`. `src/server/db/schema/index.ts` reexporta todo; `db` ya se construye con
`drizzle(sql, { schema })`, así que el barrel habilita la query API relacional sin tocar
`src/server/db/index.ts`.

## 6. Contratos de API

Envelope único de error, definido una sola vez en `src/lib/api-error.ts`:

```jsonc
{ "error": { "code": "FORBIDDEN", "message": "…", "details": null } }
```

Envelope de listas paginadas: `{ "data": T[], "meta": { "page": 1, "pageSize": 20, "total": 137 } }`.

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| POST | `/api/webhooks/clerk` | pública (firma Svix) | `WebhookEvent` de Clerk | `{ received: true }` | 400, 500 |
| GET | `/api/admin/permissions` | `roles.read` | — | `PermissionGroup[]` (agrupado por `resource`) | 401, 403, 500 |
| GET | `/api/admin/roles` | `roles.read` | — | `RoleListItem[]` (+ `permissionCount`, `userCount`) | 401, 403, 500 |
| POST | `/api/admin/roles` | `roles.create` | `CreateRoleInput` | `Role` | 400, 401, 403, 409, 500 |
| GET | `/api/admin/roles/[id]` | `roles.read` | — | `RoleDetail` (+ `permissionIds`) | 401, 403, 404, 500 |
| PATCH | `/api/admin/roles/[id]` | `roles.update` | `UpdateRoleInput` | `Role` | 400, 401, 403, 404, 409, 500 |
| DELETE | `/api/admin/roles/[id]` | `roles.delete` | — | `204` | 401, 403, 404, 409, 500 |
| PUT | `/api/admin/roles/[id]/permissions` | `roles.manage_permissions` | `SetRolePermissionsInput` | `RoleDetail` | 400, 401, 403, 404, 500 |
| GET | `/api/admin/users` | `users.read` | query: `q`, `page`, `pageSize` | `{ data: UserListItem[], meta }` | 400, 401, 403, 500 |
| PUT | `/api/admin/users/[id]/roles` | `users.assign_roles` | `SetUserRolesInput` | `UserListItem` | 400, 401, 403, 404, 500 |
| GET | `/api/admin/audit-logs` | `audit.read` | query: filtros | `{ data: AuditLogListItem[], meta }` | 400, 401, 403, 500 |

### Schemas Zod

Viven en el módulo de dominio y los importa tanto el handler (entrada) como el service
del cliente (salida): `src/modules/roles/schemas/role.schema.ts`,
`src/modules/roles/schemas/user-role.schema.ts`,
`src/modules/audit/schemas/audit-log.schema.ts`.

```ts
// roles
export const createRoleSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z][a-z0-9_-]*$/),
  name: z.string().min(2).max(80),
  description: z.string().max(280).nullish(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(280).nullish(),
}); // slug e isSystem son inmutables por contrato

export const setRolePermissionsSchema = z.object({
  permissionIds: z.array(z.uuid()).max(500),
});

// asignación a usuarios
export const setUserRolesSchema = z.object({
  roleIds: z.array(z.uuid()).max(20),
});

export const usersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// auditoría
export const auditLogsQuerySchema = z.object({
  actorId: z.uuid().optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  severity: z.enum(["info", "warning", "error"]).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
```

El payload del webhook **no** se valida con un Zod propio: `verifyWebhook()` de
`@clerk/nextjs/webhooks` devuelve un `WebhookEvent` ya tipado y con firma verificada. Se
valida únicamente la proyección que se persiste (email primario presente).

## 7. Arquitectura y archivos afectados

Mapa capa por capa según `docs/SETUP.md` §3 y §4.

- `src/server/db/schema/` — `user.ts`, `role.ts`, `permission.ts`, `role-permission.ts`,
  `user-role.ts`, `audit-log.ts`, `index.ts` (barrel, hoy `export {}`).
- `src/server/db/` — **nuevo** `pool.ts` (cliente `neon-serverless` transaccional + tipos
  `Transaction` y `Executor`); `seed.ts` (nuevo: el script `db:seed` ya lo referencia pero
  el archivo no existe). `index.ts` no se toca.
- `src/server/repositories/` — `user.repository.ts` (usuarios + `user_roles` + resolución
  de permisos efectivos), `role.repository.ts` (roles + `role_permissions`),
  `permission.repository.ts` (catálogo, solo lectura), `audit-log.repository.ts`
  (`insert` y `list`, sin update ni delete).
- `src/server/services/` — `access-control.service.ts`: reglas que cruzan repositorios y
  envuelven mutación + auditoría en una transacción (crear/actualizar/borrar rol, fijar
  matriz de permisos, asignar roles a usuario). `user-sync.service.ts`: aplica los eventos
  de Clerk sobre `users`.
- `src/lib/` — `auth.ts` (`getCurrentUser`, `requireAuth`, `requireAdmin`),
  `permissions.ts` (`PERMISSIONS`, `getEffectivePermissions`, `can`, `requirePermission`),
  `audit.ts` (`logAudit`, `maskSensitive`, `diffChanges`, `getRequestContext`),
  **nuevo** `api-error.ts` (clases de error + `toErrorResponse`).
- `src/middleware.ts` — añade `/api/webhooks(.*)` a públicas, separa matcher de admin y
  devuelve 401 JSON en `/api/**` en lugar de redirigir.
- `src/app/api/webhooks/clerk/route.ts` — **nuevo**, ruta no listada en §3 (ver decisión D6).
- `src/app/api/admin/` — `permissions/route.ts`, `roles/route.ts`, `roles/[id]/route.ts`,
  `roles/[id]/permissions/route.ts`, `users/route.ts`, `users/[id]/roles/route.ts`,
  `audit-logs/route.ts`. Los directorios `admin/roles`, `admin/permissions` y
  `admin/audit-logs` ya existen vacíos.
- `src/app/(admin)/admin/layout.tsx` — guard real por permiso (hoy placeholder).
- `src/app/(admin)/admin/roles/page.tsx` y `admin/audit-logs/page.tsx` — **nuevos**
  (directorios existentes, vacíos).
- `src/modules/roles/` — `schemas/`, `types/`, `services/`, `hooks/`, `components/`,
  `constants.ts`.
- `src/modules/audit/` — ídem.
- `src/components/shared/data-table.tsx` — **nuevo**, tabla genérica con paginación
  controlada por el servidor.
- `src/components/ui/` — añadir vía `npx shadcn@latest add`: `checkbox`, `alert-dialog`,
  `popover`, `calendar`, `textarea`, `scroll-area`. Verificado: hoy solo hay `avatar`,
  `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `field`, `input`, `label`,
  `select`, `separator`, `sheet`, `skeleton`, `sonner`, `table`, `tabs`.
- `.env.example` — añadir `CLERK_WEBHOOK_SIGNING_SECRET` y `SEED_ADMIN_EMAIL`.

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **D1** — Añadir `src/server/db/pool.ts` con `drizzle-orm/neon-serverless` (`Pool`) para escrituras transaccionales; `src/server/db/index.ts` (`neon-http`) se mantiene para lecturas. | Usar `db.transaction()` del cliente actual. | Verificado en `node_modules/drizzle-orm/neon-http/session.js:152`: el driver HTTP lanza `"No transactions support in neon-http driver"`. `docs/SETUP.md` §5.2 regla 2 exige que el log se escriba en la misma transacción que la mutación, así que un cliente transaccional es obligatorio. |
| **D2** — No instalar `ws`. | `npm i ws @types/ws` para el driver WebSocket. | El entorno corre Node v24 y `@neondatabase/serverless` solo requiere `webSocketConstructor` "si no hay un objeto `WebSocket` global, como en versiones antiguas de Node" (`index.d.mts:641-646`). Node ≥22 lo trae. Se documenta como riesgo si el runtime de despliegue baja de versión. |
| **D3** — No instalar `svix`; usar `verifyWebhook` de `@clerk/nextjs/webhooks`. | `svix` manual con las cabeceras `svix-id/timestamp/signature`. | Verificado: `@clerk/nextjs` v7 exporta `./webhooks` con `verifyWebhook(request, options)` y `@clerk/backend` ya trae `standardwebhooks` como dependencia. Menos superficie y menos código de verificación propio. La env var es `CLERK_WEBHOOK_SIGNING_SECRET`. |
| **D4** — `requireAdmin()` se implementa como `requirePermission(PERMISSIONS.ADMIN_ACCESS)` sobre el código `admin.access`. | Un `requireAdmin()` que compare `role.slug === 'admin'`. | `docs/SETUP.md` §5.1 regla 1 y CLAUDE.md §4 regla 8 declaran bloqueante comparar por nombre de rol. Así se conserva el nombre de helper que pide §3 sin violar la regla: `admin.access` es un permiso más de la tabla semilla, y `manager`/`support` también lo tienen. |
| **D5** — Un usuario sin filas en `user_roles` resuelve los permisos del rol `customer`; **no** se le inserta una fila al crearlo. | Insertar `user_roles(customer)` en el webhook `user.created`. | §5.1 regla 3 pide que el default viva "en un solo lugar del servidor". Con la constante `DEFAULT_ROLE_SLUG` dentro de `getEffectivePermissions()` hay una sola fuente; con la inserción habría dos (el webhook y el fallback) y quedarían desincronizadas ante backfills. |
| **D6** — El webhook vive en `src/app/api/webhooks/clerk/route.ts`. | `src/app/api/clerk/route.ts` o una ruta ya listada. | §3 no contempla webhooks en su árbol. Se elige el subárbol `webhooks/<proveedor>` porque es la convención documentada de Clerk y deja sitio a futuros proveedores (pagos) sin ensuciar `/api` raíz. Desviación consciente sobre §3, acotada a esta carpeta. |
| **D7** — `logAudit()` **exige** un `Executor` (transacción o cliente) como primer parámetro; no abre transacción propia. | Que `logAudit()` haga su propio `db.insert()`. | Es la única forma de garantizar §5.2 regla 2. Si abriera su propia conexión, el log sobreviviría a un rollback de la mutación. |
| **D8** — `logAudit()` distingue acciones de seguridad por prefijo (`auth.`, `role.`, `permission.`, `user.role`) y en ellas propaga el error; en el resto lo captura y lo reporta sin romper la operación. | Propagar siempre, o tragar siempre. | Es literalmente §5.2 regla 4. El prefijo se evalúa en una función pura `isSecurityAction(action)` para que sea testeable y no se disperse en cada llamador. |
| **D9** — `audit_logs` es append-only por diseño de la superficie del repositorio (solo `insert` y `list`), no por trigger de base de datos. | Trigger/`RULE` en Postgres que rechace `UPDATE`/`DELETE`. | El trigger es más fuerte pero drizzle-kit no lo gestiona y quedaría fuera de las migraciones versionadas. Se difiere a §11 con la purga por retención, que es cuando hará falta un `DELETE` controlado. |
| **D10** — `data-table.tsx` usa la API nueva `useTable` de TanStack Table v9 y `flexRender` desde `@tanstack/react-table/flex-render`. | El patrón v8 (`useReactTable`) de la documentación de shadcn. | La versión instalada es **9.2.4**, no la v8 que anuncia §1 de SETUP. En v9 el punto de entrada raíz exporta `useTable`; el shim v8 vive en `@tanstack/react-table/legacy` como `useLegacyTable` y **todo su contenido está marcado `@deprecated`**. Escribir el único componente de tabla del proyecto sobre una API deprecada desde el día uno es deuda gratuita. |
| **D11** — Paginación y filtrado de `audit-logs` y `users` **en el servidor** (`manualPagination`). | Traer todo y filtrar en cliente con los row models de TanStack. | `audit_logs` crece sin techo; es la tabla con más volumen previsible del sistema. El filtrado en cliente rompería en cuanto haya tráfico real y obligaría a reescribir la vista. |
| **D12** — Nuevo `src/lib/api-error.ts` con `AppError`/`UnauthorizedError`/`ForbiddenError`/`NotFoundError`/`ConflictError` y `toErrorResponse(e)`. | Construir el `NextResponse.json` de error en cada handler. | Son 11 endpoints con el mismo mapeo de códigos; sin él, la forma del error diverge entre handlers y `requirePermission()` no tendría un canal limpio para señalar 403. Es una adición a la lista de `lib/` de §3, no un reemplazo. |
| **D13** — Los permisos efectivos se resuelven una vez por request con `cache()` de React. | Consultar en cada `requirePermission()`. | Un handler puede verificar varios permisos y el layout admin verifica antes que el handler. `cache()` deduplica por request sin introducir un caché con invalidación (que sí violaría "ante discrepancia gana Postgres"). |
| **D14** — En un rol con `isSystem: true`, `name` es inmutable (`ConflictError` 409 si el `PATCH` intenta cambiarlo) pero `description` **sigue siendo editable**. | Congelar el rol de sistema entero y rechazar cualquier `PATCH` sobre él. | `docs/SETUP.md` §5.1 regla dura 2 prohíbe borrar y **renombrar** roles de sistema; el nombre es su identidad visible en la UI de asignación y en `audit_logs`, así que cambiarlo rompe la trazabilidad de lo ya registrado. `description` es texto de ayuda: no identifica al rol, no lo referencia ningún registro y ajustarlo permite documentar mejor el modelo sin tocar la semántica. Congelar el rol entero habría dejado los cuatro roles sembrados sin forma de aclarar su alcance salvo reeditando `db:seed`. El guard vive en `updateRole()` dentro de la transacción, antes de escribir, con el mismo criterio que ya usaba `deleteRole()`; la UI deshabilita el input de `name` cuando `role.isSystem`. |

**Skills**: del mapa de CLAUDE.md §8 no hay ninguna instalada en esta sesión —
`superpowers:brainstorming`, `superpowers:writing-plans`, `clerk-webhooks`,
`clerk-nextjs-patterns`, `vercel:nextjs`, `vercel:vercel-storage`, `frontend-design` y
`web-design-guidelines` no aparecen en el listado disponible. Las únicas del mapa que sí
están son `security-review` (opera sobre un diff pendiente, y aquí no hay código escrito)
y `dataviz` (no aplica: esta feature no tiene gráficos). Se procedió sin ellas y las
decisiones de arriba se fundamentaron leyendo directamente `node_modules` en lugar de
citar documentación de memoria.

## 9. Tareas

### F0 — Prerrequisitos (humanos, fuera del alcance del developer)

- [ ] **T0.1** — Crear proyecto Neon y poner `DATABASE_URL` real en `.env.local`.
- [ ] **T0.2** — Crear aplicación Clerk, poner `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y
  `CLERK_SECRET_KEY` reales en `.env.local`.
- [ ] **T0.3** — Crear el endpoint de webhook en el dashboard de Clerk apuntando a
  `<url>/api/webhooks/clerk` con los eventos `user.created`, `user.updated`,
  `user.deleted`; copiar el signing secret a `CLERK_WEBHOOK_SIGNING_SECRET`.

### F1 — Esquema y migración

- [x] **T1** — Crear tabla `users` con sus índices y relaciones · archivo:
  `src/server/db/schema/user.ts` · verificación: `npm run typecheck`
- [x] **T2** — Crear tabla `roles` · archivo: `src/server/db/schema/role.ts` ·
  verificación: `npm run typecheck`
- [x] **T3** — Crear tabla `permissions` · archivo: `src/server/db/schema/permission.ts` ·
  verificación: `npm run typecheck`
- [x] **T4** — Crear pivote `role_permissions` con PK compuesta · archivo:
  `src/server/db/schema/role-permission.ts` · verificación: `npm run typecheck`
- [x] **T5** — Crear pivote `user_roles` con PK compuesta y `assigned_by` · archivo:
  `src/server/db/schema/user-role.ts` · verificación: `npm run typecheck`
- [x] **T6** — Crear enum `audit_severity` y tabla `audit_logs` con los 4 índices de §5.2 ·
  archivo: `src/server/db/schema/audit-log.ts` · verificación: `npm run typecheck`
- [x] **T7** — Reexportar las seis tablas, el enum y las relaciones · archivo:
  `src/server/db/schema/index.ts` · verificación: `npm run typecheck`
- [ ] **T8** — Generar y aplicar la migración inicial · archivo: `drizzle/` (generado) ·
  verificación: `npm run db:generate && npm run db:migrate`
  > **PARCIAL — bloqueada por T0.1.** `npm run db:generate` ✓: genera
  > `drizzle/0000_wild_spot.sql` con las 6 tablas, el enum `audit_severity`, los 13
  > índices y las 6 FK. `npm run db:migrate` ✗: `DATABASE_URL` en `.env.local` sigue
  > siendo el placeholder de `.env.example`. Se completa sola en cuanto exista el Neon real.

### F2 — Cliente transaccional y primitivas de `lib/`

- [x] **T9** — Cliente Drizzle sobre `Pool` de `neon-serverless` exportando `dbTx`, el tipo
  `Transaction` y el tipo `Executor` · archivo: `src/server/db/pool.ts` · verificación:
  `npm run typecheck`
- [x] **T10** — Clases de error de aplicación y `toErrorResponse()` con el envelope de §6 ·
  archivo: `src/lib/api-error.ts` · verificación: `npm run typecheck`
- [x] **T11** — Catálogo `PERMISSIONS` (`as const`), tipo `PermissionCode`, agrupación por
  recurso y `DEFAULT_ROLE_SLUG` · archivo: `src/lib/permissions.ts` · verificación:
  `npm run typecheck`
- [x] **T12** — Definición de los roles de sistema y su set de permisos (`customer`,
  `admin`, `manager`, `support`) como constante tipada · archivo:
  `src/modules/roles/constants.ts` · verificación: `npm run typecheck`

### F3 — Repositorios

- [x] **T13** — Catálogo de permisos, solo lectura (`findAll`, `findByIds`, `findByCodes`) ·
  archivo: `src/server/repositories/permission.repository.ts` · verificación:
  `npm run typecheck`
- [x] **T14** — Roles y su matriz: CRUD, `findBySlug`, `listWithCounts`,
  `getPermissionIds`, `replacePermissions(tx, …)` · archivo:
  `src/server/repositories/role.repository.ts` · verificación: `npm run typecheck`
- [x] **T15** — Usuarios: `findByClerkId`, `findById`, `upsertFromClerk(tx, …)`,
  `softDeleteByClerkId(tx, …)`, `listPaginated`, `getRoleIds`,
  `replaceRoles(tx, …)` y `findEffectivePermissionCodes(userId)` con el join
  `user_roles → role_permissions → permissions` · archivo:
  `src/server/repositories/user.repository.ts` · verificación: `npm run typecheck`
- [x] **T16** — Auditoría append-only: solo `insert(executor, row)` y
  `listPaginated(filters)`; sin `update` ni `delete` en la superficie pública · archivo:
  `src/server/repositories/audit-log.repository.ts` · verificación: `npm run typecheck`

### F4 — Auditoría, autenticación y autorización

- [x] **T17** — `maskSensitive()`, `diffChanges()`, `isSecurityAction()`,
  `getRequestContext()` y `logAudit(executor, entry)` con la política de fallo de D8 ·
  archivo: `src/lib/audit.ts` · verificación: `npm run typecheck`
- [x] **T18** — `getCurrentUser()` (cacheado por request), `requireAuth()` y
  `requireAdmin()` delegando en `requirePermission(PERMISSIONS.ADMIN_ACCESS)` · archivo:
  `src/lib/auth.ts` · verificación: `npm run typecheck`
- [x] **T19** — Añadir a `permissions.ts` la resolución en servidor:
  `getEffectivePermissions()` con `cache()`, fallback al rol `DEFAULT_ROLE_SLUG`, `can()` y
  `requirePermission()` que lanza `ForbiddenError` · archivo: `src/lib/permissions.ts` ·
  verificación: `npm run typecheck`

### F5 — Seed

- [ ] **T20** — Seed idempotente: upsert de `permissions` desde `PERMISSIONS`, upsert de
  los cuatro roles de sistema, sincronización de `role_permissions`, y asignación opcional
  del rol `admin` al usuario de `SEED_ADMIN_EMAIL` si ya existe · archivo:
  `src/server/db/seed.ts` · verificación: `npm run db:seed` dos veces seguidas sin
  duplicados (AC8)
  > **PARCIAL — bloqueada por T0.1.** El script está escrito y `npm run db:seed` lo
  > carga, resuelve los alias `@/` y llega a abrir la transacción; falla únicamente al
  > conectar, porque `DATABASE_URL` es el placeholder. AC8 no se puede comprobar sin
  > el Neon real.
- [x] **T21** — Añadir `CLERK_WEBHOOK_SIGNING_SECRET` y `SEED_ADMIN_EMAIL` · archivo:
  `.env.example` · verificación: revisión manual

### F6 — Sincronización con Clerk y guards

- [x] **T22** — Servicio que aplica los eventos de Clerk sobre `users` (mapeo del email
  primario, upsert idempotente por `clerk_id`, soft delete) y escribe su `audit_log` con
  `actorId = null` dentro de la misma transacción · archivo:
  `src/server/services/user-sync.service.ts` · verificación: `npm run typecheck`
- [x] **T23** — Route Handler del webhook: `verifyWebhook()`, despacho por `evt.type`, 400
  ante firma inválida, 200 ante evento no manejado · archivo:
  `src/app/api/webhooks/clerk/route.ts` · verificación: `npm run build` + POST con firma
  inválida devuelve 400 (AC2)
- [x] **T24** — Middleware: `/api/webhooks(.*)` público, matcher de admin, 401 JSON para
  `/api/**` no autenticado y redirección a `/sign-in` para páginas; sin acceso a BD ·
  archivo: `src/middleware.ts` · verificación: `npm run build` + AC5
- [x] **T25** — Guard real del layout admin con `requireAdmin()` y redirección a `/` ante
  `ForbiddenError` · archivo: `src/app/(admin)/admin/layout.tsx` · verificación: AC6

### F7 — Servicio de control de acceso

- [x] **T26** — `access-control.service.ts`: `createRole`, `updateRole`, `deleteRole`
  (409 si `isSystem` o si tiene usuarios), `setRolePermissions`, `setUserRoles`; cada
  mutación en una transacción de `dbTx` junto a su `logAudit()` · archivo:
  `src/server/services/access-control.service.ts` · verificación: `npm run typecheck`

### F8 — API admin

- [x] **T27** — `GET /api/admin/permissions` agrupado por recurso · archivo:
  `src/app/api/admin/permissions/route.ts` · verificación: `npm run build`
- [x] **T28** — `GET` y `POST /api/admin/roles` · archivo:
  `src/app/api/admin/roles/route.ts` · verificación: `npm run build`
- [x] **T29** — `GET`, `PATCH` y `DELETE /api/admin/roles/[id]` · archivo:
  `src/app/api/admin/roles/[id]/route.ts` · verificación: AC11, AC12
- [x] **T30** — `PUT /api/admin/roles/[id]/permissions` · archivo:
  `src/app/api/admin/roles/[id]/permissions/route.ts` · verificación: AC9
- [x] **T31** — `GET /api/admin/users` con búsqueda y paginación · archivo:
  `src/app/api/admin/users/route.ts` · verificación: `npm run build`
- [x] **T32** — `PUT /api/admin/users/[id]/roles` · archivo:
  `src/app/api/admin/users/[id]/roles/route.ts` · verificación: `npm run build`
- [x] **T33** — `GET /api/admin/audit-logs` con los filtros de `auditLogsQuerySchema` ·
  archivo: `src/app/api/admin/audit-logs/route.ts` · verificación: AC14

### F9 — Base de UI compartida

- [x] **T34** — Instalar componentes shadcn faltantes · comando:
  `npx shadcn@latest add checkbox alert-dialog popover calendar textarea scroll-area` ·
  verificación: `npm run build`
- [x] **T35** — `DataTable<TData>` genérica con `useTable` de v9, `flexRender` desde
  `@tanstack/react-table/flex-render`, paginación controlada por el servidor y slots de
  carga/vacío · archivo: `src/components/shared/data-table.tsx` · verificación:
  `npm run typecheck`

### F10 — Módulo `roles` (cliente)

- [x] **T36** — Schemas Zod de roles y tipos de respuesta · archivo:
  `src/modules/roles/schemas/role.schema.ts` · verificación: `npm run typecheck`
- [x] **T37** — Schemas Zod de asignación usuario↔rol y query de usuarios · archivo:
  `src/modules/roles/schemas/user-role.schema.ts` · verificación: `npm run typecheck`
- [x] **T38** — Tipos derivados del schema Drizzle para el módulo · archivo:
  `src/modules/roles/types/index.ts` · verificación: `npm run typecheck`
- [x] **T39** — Service axios de roles y permisos · archivo:
  `src/modules/roles/services/role.service.ts` · verificación: `npm run typecheck`
- [x] **T40** — Service axios de usuarios y sus roles · archivo:
  `src/modules/roles/services/user-role.service.ts` · verificación: `npm run typecheck`
- [x] **T41** — Hooks de lectura: `useRoles`, `useRole`, `usePermissions` · archivo:
  `src/modules/roles/hooks/use-roles.ts` · verificación: `npm run typecheck`
- [x] **T42** — Hooks de mutación de roles: `useCreateRole`, `useUpdateRole`,
  `useDeleteRole` con invalidación de queries · archivo:
  `src/modules/roles/hooks/use-role-mutations.ts` · verificación: `npm run typecheck`
- [x] **T43** — Hooks de matriz y asignación: `useSetRolePermissions`, `useUsers`,
  `useSetUserRoles` · archivo: `src/modules/roles/hooks/use-access-assignments.ts` ·
  verificación: `npm run typecheck`
- [x] **T44** — Tabla de roles con badge de sistema y contadores · archivo:
  `src/modules/roles/components/role-table.tsx` · verificación: `npm run build`
- [x] **T45** — Diálogo de alta/edición de rol (RHF + zodResolver), con `slug` bloqueado en
  edición · archivo: `src/modules/roles/components/role-form-dialog.tsx` · verificación:
  `npm run build`
- [x] **T46** — Diálogo de confirmación de borrado con `alert-dialog` y manejo del 409 ·
  archivo: `src/modules/roles/components/role-delete-dialog.tsx` · verificación: AC11
- [x] **T47** — Matriz rol×permiso agrupada por recurso, con guardado explícito · archivo:
  `src/modules/roles/components/permission-matrix.tsx` · verificación: AC9
- [x] **T48** — Tabla de usuarios con búsqueda server-side y avatar · archivo:
  `src/modules/roles/components/user-table.tsx` · verificación: `npm run build`
- [x] **T49** — Diálogo de asignación de roles a un usuario · archivo:
  `src/modules/roles/components/user-role-dialog.tsx` · verificación: `npm run build`
- [x] **T50** — Página `/admin/roles` con tabs "Roles" y "Usuarios" · archivo:
  `src/app/(admin)/admin/roles/page.tsx` · verificación: `npm run build`

### F11 — Módulo `audit` (cliente)

- [x] **T51** — Schemas Zod de filtros y de la respuesta de bitácora · archivo:
  `src/modules/audit/schemas/audit-log.schema.ts` · verificación: `npm run typecheck`
- [x] **T52** — Tipos derivados del schema Drizzle · archivo:
  `src/modules/audit/types/index.ts` · verificación: `npm run typecheck`
- [x] **T53** — Service axios de bitácora · archivo:
  `src/modules/audit/services/audit-log.service.ts` · verificación: `npm run typecheck`
- [x] **T54** — Hook `useAuditLogs` con `placeholderData` para paginación estable ·
  archivo: `src/modules/audit/hooks/use-audit-logs.ts` · verificación: `npm run typecheck`
- [x] **T55** — Barra de filtros (actor, entidad, acción, severidad, rango de fechas) con
  estado en la URL · archivo: `src/modules/audit/components/audit-log-filters.tsx` ·
  verificación: `npm run build`
- [x] **T56** — Tabla de bitácora sobre `DataTable`, severidad como badge · archivo:
  `src/modules/audit/components/audit-log-table.tsx` · verificación: AC14
- [x] **T57** — Panel lateral de detalle con el diff `before/after` formateado · archivo:
  `src/modules/audit/components/audit-log-detail-sheet.tsx` · verificación: `npm run build`
- [x] **T58** — Página `/admin/audit-logs` · archivo:
  `src/app/(admin)/admin/audit-logs/page.tsx` · verificación: `npm run build`

### F12 — Cierre

- [x] **T59** — Barrido de `role === '…'` y comparaciones por nombre de rol en todo `src/` ·
  verificación: AC15
- [x] **T60** — `npm run typecheck && npm run lint && npm run build` · verificación: AC17

## 12. Revisión (reviewer) — iteración 1

**Verificación independiente repetida:** `npm run typecheck` ✓ · `npm run lint` ✓ ·
`npm run build` ✓ (14 rutas). AC15 y AC16 confirmados por inspección (sin comparaciones
por nombre de rol; `audit-log.repository.ts` solo expone `insert`/`listPaginated`).
Doble capa de guard, transacciones de escritura vía `Executor`/`dbTx`, enmascarado de
campos sensibles, idempotencia del seed y verificación de firma del webhook: todo
revisado y correcto.

**Hallazgo bloqueante:**

- **Los roles de sistema se pueden renombrar.** `docs/SETUP.md` §5.1 regla dura 2:
  "Los roles de sistema (`is_system = true`) no se borran ni se renombran desde la UI."
  `deleteRole()` en `src/server/services/access-control.service.ts` sí bloquea el borrado
  (`ConflictError` si `role.isSystem`), pero `updateRole()` no tiene el mismo guard: acepta
  `name`/`description` para cualquier rol, sistema o no. `PATCH /api/admin/roles/[id]` con
  `{"name": "Super Admin"}` sobre el rol `admin` sembrado por `db:seed` se aplica sin error.
  `src/modules/roles/components/role-form-dialog.tsx` solo deshabilita el campo `slug`
  (`disabled={isEditing}`, línea 93) cuando edita; `name` y `description` quedan editables
  también para roles de sistema. La nota del spec en §6 ("slug e isSystem son inmutables
  por contrato") no menciona `name`/`description` como excepción deliberada — no está en
  la lista de decisiones D1–D13, así que se trata de un vacío de implementación, no una
  desviación consciente.
  - **Corrección esperada:** `updateRole()` rechaza con `ConflictError` (409) si
    `role.isSystem` y el `input` intenta cambiar `name` (o cualquier campo distinto de
    los ya inmutables); o, si se decide permitir `description` pero no `name` en roles de
    sistema, documentarlo como decisión D14 con su razón. La UI deshabilita el campo
    `name` (y, según se decida, `description`) en `role-form-dialog.tsx` cuando
    `role.isSystem`, con el mismo criterio que ya aplica a `slug`.

**Veredicto:** no limpio. Un hallazgo bloqueante, el resto de la superficie auditada está
correcta. Vuelve a `developer` para la corrección puntual antes de marcar `done`.

**Cierre del hallazgo (developer):** corregido. `updateRole()` en
`src/server/services/access-control.service.ts` lanza `ConflictError` ("Los roles de
sistema no se pueden renombrar.") cuando `current.isSystem` y el `input` trae un `name`
distinto del actual; el guard va dentro de la transacción y antes de
`roleRepository.update()`, igual que el de `deleteRole()`. `description` se mantiene
editable en roles de sistema por decisión explícita, ahora documentada como **D14** en §8.
`src/modules/roles/components/role-form-dialog.tsx` deshabilita el input de `name` cuando
`role.isSystem` (mismo patrón `disabled={…}` que ya usaba `slug`) y el `DialogDescription`
explica el motivo. Verificación repetida: `npm run typecheck` ✓ · `npm run lint` ✓ ·
`npm run build` ✓. Sin otros cambios: ninguna tarea de §9 se reabrió.

**Revisión (reviewer) — iteración 2:** verificación independiente repetida sobre el fix:
`updateRole()` bloquea el `name` de un rol de sistema con 409 comparando contra el valor
actual (no rompe un `PATCH` que reenvía el mismo nombre), `role-form-dialog.tsx` deshabilita
el input correspondiente y D14 queda documentada con su razón. `npm run typecheck`,
`npm run lint` y `npm run build` repetidos de forma independiente, en verde. **Veredicto:
limpio.** Spec → `status: done`, salvo T0.1–T0.3, la mitad de T8 (`db:migrate`) y la
verificación de T20 (AC8) y AC1–AC14 en runtime, que quedan explícitamente pendientes de
que el usuario provea un proyecto Neon y una app Clerk reales — no son hallazgos de
revisión, son prerrequisitos humanos ya señalados desde el spec original.

## 9.1 Nota de ejecución (developer)

**Verificación:** `npm run typecheck` ✓ · `npm run lint` ✓ · `npm run build` ✓ (14 rutas,
las 11 de la API entre ellas).

**Bloqueado por F0** (prerrequisitos humanos no cumplidos: `.env.local` conserva los
placeholders de `.env.example`):

| Pendiente | Falta |
|---|---|
| T0.1, T0.2, T0.3 | Acción humana |
| T8 (mitad `db:migrate`), T20 (verificación AC8) | `DATABASE_URL` real |
| AC1–AC14 (comprobación en runtime) | Neon + Clerk reales y `db:migrate` + `db:seed` aplicados |

AC15, AC16 y AC17 sí quedan verificados de forma estática. El resto del código está
completo y compila; solo falta ejercitarlo contra los servicios reales.

**Desviaciones conscientes sobre §7, todas por necesidad y acotadas:**

1. **`src/lib/permissions.catalog.ts` (nuevo).** T11 y T19 comparten archivo en el spec,
   pero `db:seed` corre bajo `tsx` fuera de Next: importar el catálogo desde
   `lib/permissions.ts` arrastraba `@clerk/nextjs/server`. El catálogo puro vive ahora en
   `permissions.catalog.ts` y `lib/permissions.ts` lo **reexporta**, así que la ruta de
   import que declara el spec (`@/lib/permissions`) sigue siendo válida para los handlers.
2. **`src/server/db/index.ts` (§7 decía "no se toca").** `neon()` valida la cadena de
   conexión al evaluar el módulo, y `next build` evalúa ese módulo: con el placeholder de
   `.env.local` el build era imposible. Se envolvió `db` en un Proxy de inicialización
   perezosa. Misma API, mismo tipo; además el build deja de exigir credenciales en CI.
3. **`drizzle.config.ts`.** Añadido `dotenv` con `path: ['.env.local', '.env']`:
   drizzle-kit corre fuera de Next y no cargaba `.env.local`, así que `db:migrate` y
   `db:seed` nunca habrían visto la URL real.
4. **`src/lib/axios.ts`.** Interceptor que traduce el envelope de error de §6 a una clase
   `ApiError` con mensaje mostrable. Es el sitio que `docs/SETUP.md` §3 asigna a los
   interceptores y evita repetir el desempaquetado en cada hook.
5. **Dos componentes contenedores no listados** (`access-workspace.tsx`,
   `audit-log-explorer.tsx`): mantienen `"use client"` fuera de las páginas, que quedan
   como Server Components (CLAUDE.md §4 regla 7).
6. **`src/hooks/use-debounce.ts`** para la búsqueda server-side de usuarios y
   **`src/types/api.ts`** (`Paginated`, `Serialized`) compartido por los módulos `roles` y
   `audit`; ambos son los sitios que marca `docs/SETUP.md` §3.
7. **`data-table.tsx`** usa `flexRender` de `@tanstack/react-table/flex-render` como pide
   D10. Los tipos genéricos se acotan con `TData extends RowData`, que v9 exige.
8. **T36/T37/T38 y T51/T52 se ejecutaron antes que F8**: los Route Handlers importan esos
   schemas Zod, así que el orden del spec era imposible por dependencia.

## 10. Riesgos y consideraciones

- **Dos clientes de base de datos (D1).** El riesgo real es que alguien mute con `db`
  (HTTP, sin transacción) y se salte la auditoría. Mitigación: los métodos de escritura de
  los repositorios reciben un `Executor` obligatorio como primer parámetro, de modo que
  omitir la transacción no compila limpio; el reviewer debe verificar que ningún repositorio
  importe `db` para escribir.
- **Node < 22 en el runtime de despliegue (D2).** Si el target baja de versión, el `Pool`
  de Neon falla en tiempo de ejecución por falta de `WebSocket` global. Señal: error de
  conexión solo en producción. Remedio: `npm i ws` y `neonConfig.webSocketConstructor = ws`.
- **N+1 en la resolución de permisos.** `findEffectivePermissionCodes` debe ser **un solo**
  join `user_roles → role_permissions → permissions`, nunca un bucle sobre roles. Con
  `cache()` (D13) se ejecuta una vez por request.
- **Race condition en la matriz de permisos.** Dos admins guardando el mismo rol a la vez:
  el último gana en silencio. Aceptado para el volumen esperado; el `audit_log` deja
  reconstruir qué pasó. Si molesta, se añade un `version` optimista al rol.
- **Reintentos y desorden del webhook.** Clerk reintenta ante error y no garantiza orden.
  Los handlers son idempotentes (upsert por `clerk_id`), pero un `user.updated` viejo podría
  pisar uno nuevo. Riesgo bajo; si aparece, comparar `data.updated_at` antes de escribir.
- **Colisión de email.** `users.email` es único, y Clerk permite que un usuario cambie a un
  email que ya existía en una fila soft-deleted. El upsert debe resolver el conflicto por
  `clerk_id` y devolver 409 auditado si el email choca con otro `clerk_id` activo.
- **Auto-bloqueo del último admin.** Nada impide que un admin se quite a sí mismo el rol o
  vacíe los permisos del rol `admin` y deje el panel inaccesible. Mitigación mínima en T26:
  rechazar la operación que dejaría cero usuarios con `admin.access`. Recuperación:
  `npm run db:seed` con `SEED_ADMIN_EMAIL`.
- **Fuga de PII en `changes`.** El enmascarado de T17 es por lista de claves; un campo
  sensible con nombre inesperado se colaría. Los llamadores deben pasar solo los campos que
  cambiaron, no el registro entero.
- **`audit_logs` crece sin techo.** Sin purga (§11), la tabla es el primer cuello de
  botella del sistema. Los índices de §5.2 y la paginación server-side (D11) cubren el corto
  plazo.
- **Divergencia de versiones respecto a `docs/SETUP.md` §1.** Instalado: TanStack Table
  **9.2.4** (SETUP dice v8) y Recharts **3.10.1** (SETUP dice v2). Esta feature solo se ve
  afectada por lo primero (D10); Recharts lo heredará el spec del dashboard.
- **`middleware.ts` corre en el borde.** No puede tocar la base de datos: por eso la capa 1
  solo autentica y la autorización por permiso vive íntegra en la capa 2.

## 11. Fuera de alcance / deuda aceptada

- **Purga por retención de `audit_logs`** (180 días para `info`, indefinida para `auth.*` y
  `role.*`, §5.2 regla 5). Se retoma cuando la tabla supere el orden del millón de filas o
  al primer aviso de cuota de Neon.
- **Trigger de Postgres que impida `UPDATE`/`DELETE` sobre `audit_logs`** (D9). Se retoma
  junto con la purga, que es cuando habrá un `DELETE` legítimo que exceptuar.
- **Poda de permisos huérfanos en el seed**: si un código desaparece de `PERMISSIONS`, su
  fila y sus `role_permissions` sobreviven. Se retoma cuando se renombre el primer permiso.
- **Caché de permisos en `publicMetadata` de Clerk**: §5.1 lo declara opcional y derivado.
  Se retoma solo si `getEffectivePermissions` aparece como coste medible.
- **Tests automatizados**: el proyecto no tiene runner configurado. La verificación de cada
  tarea es `typecheck`/`lint`/`build` más comprobación manual de los AC. Se retoma con el
  spec que introduzca Vitest.
- **`orders.userId` y demás FK hacia `users`**: las declaran los specs de sus tablas.
- **Auditoría de eventos `auth.*`** (login fallido, cambio de contraseña): requiere eventos
  de sesión de Clerk que no están en el alcance de webhooks de esta feature. El prefijo y la
  columna ya quedan listos.
