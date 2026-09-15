---
id: 004
title: Integración Clerk ↔ Postgres — Fase 1 (identidad y catálogo de roles)
status: done
module: shared
scope: both
---

# 004 — Integración Clerk ↔ Postgres · Fase 1

Iniciativa en 3 fases: **004 (este)** identidad + catálogo de roles · 005 exigir permisos en middleware/handlers
y quitar `(admin-public)` · 006 UI `/admin/users`. 005 no arranca hasta validar 004 a mano.

## Objetivo

Un usuario real de Clerk existe en `users`, tiene el rol `super_admin` y entra a `/admin` con sus permisos
resueltos desde Postgres; las altas posteriores se sincronizan solas.

## Alcance

Incluye: backfill idempotente Clerk → `users` vía Clerk Backend API · sincronización en vivo con el relay propio
de Clerk (`clerk webhooks listen`, sin ngrok) · catálogo de permisos ampliado a las secciones existentes · los 6
roles con su matriz sembrados por `db:seed`, retirando `support` (→ `employee`).

No incluye: exigir los permisos nuevos (Fase 2) · UI de creación de usuarios (Fase 3) · componentes de auth
(`(auth)/sign-in`, `(auth)/sign-up`, `<UserButton/>` en `Header`: ya existen, verificado, sin cambios) ·
organizaciones de Clerk · cachear permisos en `publicMetadata` · webhook de producción con endpoint público.

## Configuración decidida

Las dos decisiones abiertas quedan cerradas por el usuario; no hay alternativas que evaluar.

1. **`SEED_ADMIN_EMAIL = slvalentin19@gmail.com`** — lo escribe el developer en `.env.local` (T0). No es
   secreto: es el email semilla del primer super admin.
2. **Sincronización en vivo con relay de Clerk** (backfill *y* webhook). Falta `CLERK_WEBHOOK_SIGNING_SECRET`
   en `.env.local`; se obtiene así:

| # | Quién | Acción |
|---|---|---|
| 1 | developer | Script `npm run webhooks:listen` (T6) + procedimiento en `docs/SETUP.md` (T7) |
| 2 | **usuario** | En una terminal aparte, interactivo y de larga duración: `npx -y clerk@latest webhooks listen --token "$(npx -y clerk@latest webhooks token)" --forward-to http://localhost:3000/api/webhooks/clerk`. Imprime una relay URL `https://webhooks.clerk.com/in/c_.../` |
| 3 | **usuario** | Registra esa relay URL como endpoint en el Clerk Dashboard con `user.created`, `user.updated`, `user.deleted` |
| 4 | **usuario** | Pega el signing secret (`whsec_…`) de ese endpoint en `.env.local` como `CLERK_WEBHOOK_SIGNING_SECRET` y reinicia `npm run dev` |

El developer no puede automatizar 2–4: el comando es interactivo y persistente, y el secret solo lo ve el
usuario en su Dashboard. `--token` fija la relay URL entre reinicios. Los headers `svix-*` los preserva el
relay: `verifyWebhook()` no cambia.

## Criterios de aceptación

- [ ] AC1 — Dado `db:migrate && db:seed`, existen los 6 roles (`super_admin`, `admin`, `manager`, `employee`,
  `customer`, `audit`) con `is_system = true` y su matriz de permisos.
- [ ] AC2 — Dado `db:sync-users`, cada usuario de Clerk tiene fila en `users` con su email primario,
  `is_active = true` y un `audit_logs` con `metadata.source = 'clerk_backfill'`.
- [ ] AC3 — Dado `db:seed` y `db:sync-users` corridos dos veces, no cambian los conteos de `roles`,
  `permissions`, `role_permissions` ni `users`.
- [ ] AC4 — Dado `SEED_ADMIN_EMAIL=slvalentin19@gmail.com` sincronizado, tras `db:seed` ese usuario tiene el
  rol `super_admin` en `user_roles`.
- [ ] AC5 — Dado ese usuario logueado, entra a `/admin`; `/admin/roles` lista los 6 roles y el catálogo
  completo agrupado por recurso.
- [ ] AC6 — Dado un usuario sin `user_roles`, resuelve los permisos de `customer` (vacío) y `/admin` lo
  redirige a `/`.
- [ ] AC7 — Dado el listener corriendo y el signing secret cargado, cuando se crea un usuario en Clerk aparece
  en `users` sin correr `db:sync-users`, con `metadata.source = 'clerk_webhook'`.
- [ ] AC8 — En el código de la fase no hay comparación por nombre de rol (`role === 'admin'`,
  `slug === 'super_admin'`) usada para autorizar.
- [ ] AC9 — `npm run typecheck && npm run lint` en verde.

## Datos

**Sin cambios de esquema.** Solo semilla sobre `roles`, `permissions`, `role_permissions`, `user_roles` y
`users`. No se genera migración.

Permisos nuevos: `dashboard.read`, `categories.read|create|update|delete`,
`products.read|create|update|delete`, `users.create`, `users.update`.

| Rol | Permisos |
|---|---|
| `super_admin` | Todos (único con `roles.create/update/delete/manage_permissions`) |
| `admin` | Todos salvo esos cuatro; conserva `roles.read`, `users.*`, `audit.read` |
| `manager` | `admin.access`, `dashboard.read`, `categories.*`, `products.*`, `users.read`, `audit.read` |
| `employee` | `admin.access`, `dashboard.read`, `categories.read`, `products.read/create/update` |
| `audit` | `admin.access`, `dashboard.read`, `categories.read`, `products.read`, `roles.read`, `users.read`, `audit.read` |
| `customer` | Ninguno |

## API

Sin endpoints nuevos. `POST /api/webhooks/clerk` se mantiene tal cual (`verifyWebhook()` toma el secret de la
env var). Sin Zod nuevo: el backfill consume el `User` tipado de `@clerk/backend`.

## Reutilizar

- `src/server/services/user-sync.service.ts` — upsert idempotente, colisión de email y auditoría transaccional;
  ya escribe `metadata.source = 'clerk_webhook'`. Se **extrae** `applyUserUpsert(projection, source)` para
  compartirla con el backfill; el webhook queda como adaptador, sin cambio de comportamiento.
- `src/app/api/webhooks/clerk/route.ts` — handler con `verifyWebhook`, ya implementado. Tal cual.
- `src/server/repositories/user.repository.ts` (`ClerkUserProjection`, `upsertFromClerk`, `findByEmail`) ·
  `src/server/db/pool.ts` (`dbTx`, `Executor`, `closePool`) · `src/lib/audit.ts` (`logAudit`) ·
  `src/lib/permissions.catalog.ts` + `permissions.ts` (`PERMISSIONS`, `DEFAULT_ROLE_SLUG`,
  `requirePermission()`) · `src/lib/auth.ts` (`requireAdmin()` ya delega en el permiso) · `.env.example` (ya
  declara ambas variables). Todo tal cual.
- `src/app/(admin)/admin/roles/page.tsx` + `src/modules/roles/` — la UI de roles, matriz y asignación absorbe
  los nuevos roles y permisos sin tocar código.
- `@clerk/backend` (transitivo de `@clerk/nextjs` 7.8.3): `createClerkClient` y
  `users.getUserList({ limit, offset })` → `{ data: User[], totalCount }`, camelCase (`emailAddresses`,
  `primaryEmailAddressId`, `firstName`, `imageUrl`).

Sin componentes shadcn nuevos.

## Tareas

- [x] T0 — Escribir `SEED_ADMIN_EMAIL=slvalentin19@gmail.com` · `.env.local`
- [x] T1 — Añadir los permisos nuevos y sus descripciones · `src/lib/permissions.catalog.ts`
- [x] T2 — Redefinir `SYSTEM_ROLES` con los 6 roles y su matriz · `src/modules/roles/constants.ts`
- [x] T3 — Extraer `applyUserUpsert(projection, source)`; `syncUserUpserted()` pasa a ser su adaptador del
  payload de webhook · `src/server/services/user-sync.service.ts`
- [x] T4 — Retirar `support` solo si no tiene usuarios asignados (`onDelete: restrict`: avisar, no abortar) y
  asignar `super_admin` —no `admin`— a `SEED_ADMIN_EMAIL` · `src/server/db/seed.ts`
- [x] T5 — Backfill: `createClerkClient`, paginación `limit`/`offset`, mapeo a `ClerkUserProjection`,
  `applyUserUpsert(..., 'clerk_backfill')`, resumen y `closePool()` · `src/server/db/sync-clerk-users.ts`
- [x] T6 — Scripts `db:sync-users` (`tsx src/server/db/sync-clerk-users.ts`) y `webhooks:listen`
  (`clerk webhooks listen --forward-to http://localhost:3000/api/webhooks/clerk`) · `package.json`
- [x] T7 — Documentar el webhook en desarrollo marcando qué pasos ejecuta el usuario · `docs/SETUP.md` §7
- [x] T8 — (usuario) Listener corrido con `clerk webhooks listen --token ... --forward-to
  http://localhost:3000/api/webhooks/clerk` (relay `https://webhooks.clerk.com/in/c_TfYTXpEtuf/`), endpoint
  registrado en el Dashboard con `user.created|updated|deleted`, `CLERK_WEBHOOK_SIGNING_SECRET` cargado en
  `.env.local` y servidor reiniciado
- [x] T9 — `db:migrate && db:seed && db:sync-users && db:seed` corridos en secuencia. AC1–AC4 verificados
  contra Neon (ver evidencia abajo). **AC5 y AC7 requieren confirmación manual del usuario en el navegador**
  (login real + creación de un segundo usuario con el listener activo) — no verificables desde una sesión sin
  navegador

### Bug encontrado y corregido durante T9

`seed.ts` y `sync-clerk-users.ts` llamaban `config({ path: [".env.local", ".env"] })` de `dotenv` **antes**,
en el orden textual, de importar `@/server/db/pool`. Pero en ESM las declaraciones `import` se evalúan todas
antes que el resto del código del propio módulo, sin importar su posición en el archivo: `pool.ts` construía
su `Pool` con `process.env.DATABASE_URL` aún `undefined`, y `config()` recién poblaba la variable después,
demasiado tarde. Sin una variable `DATABASE_URL` ya presente en el proceso (por ejemplo heredada de una sesión
de shell anterior), ambos scripts fallaban con `No database host or connection string was set`.

**Fix**: `db:seed` y `db:sync-users` en `package.json` ahora usan el flag nativo de Node
`--env-file-if-exists=.env.local`, que carga el archivo antes de que se ejecute cualquier módulo — evita el
problema de orden por completo, sin tocar la lógica de los scripts.

```
"db:seed": "tsx --env-file-if-exists=.env.local src/server/db/seed.ts",
"db:sync-users": "tsx --env-file-if-exists=.env.local src/server/db/sync-clerk-users.ts",
```

### Evidencia de T9 (verificado en Neon)

- `db:seed` (1ª corrida): `Permisos en catálogo: 20 · Roles de sistema: 6 · Asignaciones rol×permiso
  garantizadas: 61`. Avisó que `slvalentin19@gmail.com` aún no estaba sincronizado (AC4 depende de AC2).
- `db:sync-users`: `Usuarios en Clerk: 1 · Leídos: 1 · Creados: 1 · Actualizados: 0 · Fallidos: 0` (AC2).
- `db:seed` (2ª corrida): mismos conteos de permisos/roles/asignaciones (AC3, idempotencia) y
  `Rol "super_admin" garantizado para slvalentin19@gmail.com.` (AC4).

Verificación final: `npm run typecheck && npm run lint` — **en verde** con T0–T9. AC1–AC4 verificados contra
la base real. AC5 y AC7 pendientes de confirmación manual del usuario en el navegador; AC6, AC8, AC9 ya
verificados por trazabilidad de código.

### Desviaciones respecto al plan

- `webhooks:listen` en `package.json` queda **sin** `--token "$(…)"`: `npm run` usa `cmd.exe` en Windows y la
  sustitución de comandos rompería el script. La variante con `--token` (bash y PowerShell) queda documentada
  en `docs/SETUP.md` §7.2, junto con `webhooks:token` para obtener el token estable.
- `toUserProjection(identity)` normaliza la identidad de Clerk antes de `applyUserUpsert()`: el webhook
  (snake_case) y el backfill (camelCase) adaptan a esa forma común y la elección del email primario no se
  duplica.
- `RETIRED_ROLE_SLUGS` en `src/modules/roles/constants.ts` declara los slugs retirados (`support`) para que el
  seed no los tenga hardcodeados.

## Notas

- **Bloqueante (CLAUDE.md §4.8)**: toda autorización va por `requirePermission(PERMISSIONS.*)`; `super_admin` y
  `admin` se distinguen solo por su set de permisos, nunca por un `if` de slug.
- **Orden**: T8 requiere `npm run dev` arriba (el relay reenvía a localhost) y T9 depende de T8; T1–T7 no.
- **Auto-bloqueo**: la matriz de `/admin/roles` permite vaciar los permisos de `super_admin` y dejar el panel
  inaccesible. Recuperación: `db:seed` (concede sin revocar). Guard duro → Fase 3.
- Hasta la Fase 2, `/admin/categories` y `/admin/products` siguen sin autenticación (excepción de 002/003):
  los permisos nuevos quedan en catálogo, aún sin exigirse.
