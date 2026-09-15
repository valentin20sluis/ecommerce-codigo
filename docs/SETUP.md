# SETUP — E-commerce Tech

Documento único de referencia para el arranque del proyecto y la **arquitectura de
carpetas obligatoria**. Todo agente y toda tarea debe respetar esta estructura.

---

## 1. Stack

| Capa | Tecnología | Versión objetivo |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.x |
| Runtime UI | React | 19.x |
| Lenguaje | TypeScript (strict) | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Componentes | shadcn/ui (Radix + CVA) | latest |
| Base de datos | Neon Postgres (serverless) | — |
| ORM | Drizzle ORM + drizzle-kit | latest |
| Auth | Clerk (`@clerk/nextjs`) | latest |
| Estado servidor | TanStack Query v5 | 5.x |
| Tablas | TanStack Table v8 | 8.x |
| HTTP | Axios | 1.x |
| Estado cliente | Zustand | 5.x |
| Gráficos | Recharts | 2.x |
| Validación | Zod | 4.x |
| Formularios | React Hook Form + @hookform/resolvers | latest |
| Gestor de paquetes | **npm** | — |

---

## 2. Bootstrap del proyecto

```bash
# 1. Scaffold
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --turbopack --use-npm

# 2. Datos — Neon + Drizzle
npm i drizzle-orm @neondatabase/serverless
npm i -D drizzle-kit dotenv tsx

# 3. Auth
npm i @clerk/nextjs

# 4. Estado de servidor y tablas
npm i @tanstack/react-query @tanstack/react-table
npm i -D @tanstack/react-query-devtools

# 5. HTTP, estado cliente, gráficos
npm i axios zustand recharts

# 6. Validación y formularios
npm i zod react-hook-form @hookform/resolvers

# 7. UI
npx shadcn@latest init
npx shadcn@latest add button input label card table dialog sheet \
  dropdown-menu select badge separator skeleton sonner form tabs avatar

# 8. Utilidades
npm i class-variance-authority clsx tailwind-merge lucide-react next-themes
npm i -D prettier prettier-plugin-tailwindcss
```

### Variables de entorno (`.env.local`)

```bash
# Neon
DATABASE_URL="postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
# Signing secret del endpoint de webhook (ver §7). Sin él, POST /api/webhooks/clerk responde 400.
CLERK_WEBHOOK_SIGNING_SECRET="whsec_..."

# Seed
# Email del primer super administrador. `db:seed` le garantiza el rol `super_admin`
# si el usuario ya está en `users`. No es secreto. Opcional.
SEED_ADMIN_EMAIL=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

`.env.local` va en `.gitignore`. Nunca se commitea. Mantén un `.env.example` con
las claves vacías.

### Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/server/db/seed.ts",
    "db:sync-users": "tsx src/server/db/sync-clerk-users.ts",
    "webhooks:token": "npx -y clerk@latest webhooks token",
    "webhooks:listen": "npx -y clerk@latest webhooks listen --forward-to http://localhost:3000/api/webhooks/clerk"
  }
}
```

---

## 3. Arquitectura de carpetas

Estructura **modular por dominio** sobre App Router. La regla base: el `app/`
solo enruta y compone; la lógica vive en `modules/` (cliente) y `server/` (datos).

```
.
├── .claude/
│   └── agents/                  orchestrator · spec · developer · reviewer
├── docs/
│   ├── SETUP.md                 este archivo
│   └── specs/                   NNN-slug.md — specs SDD (documentación viva)
├── drizzle/                     migraciones generadas por drizzle-kit
├── drizzle.config.ts
├── public/
└── src/
    ├── app/
    │   ├── (storefront)/        módulo CLIENTE
    │   │   ├── layout.tsx       header, footer, providers de tienda
    │   │   ├── page.tsx         home
    │   │   ├── products/
    │   │   │   ├── page.tsx     catálogo + filtros
    │   │   │   └── [slug]/page.tsx
    │   │   ├── cart/page.tsx
    │   │   ├── checkout/page.tsx
    │   │   └── orders/
    │   │       ├── page.tsx
    │   │       └── [id]/page.tsx
    │   ├── (admin)/             módulo ADMINISTRACIÓN
    │   │   └── admin/
    │   │       ├── layout.tsx   sidebar + guard de rol
    │   │       ├── page.tsx     dashboard (Recharts)
    │   │       ├── products/    CRUD (TanStack Table)
    │   │       ├── categories/
    │   │       ├── orders/
    │   │       ├── customers/
    │   │       ├── roles/       roles, permisos y asignaciones
    │   │       └── audit-logs/  bitácora (TanStack Table + filtros)
    │   ├── (auth)/
    │   │   ├── sign-in/[[...sign-in]]/page.tsx
    │   │   └── sign-up/[[...sign-up]]/page.tsx
    │   ├── api/                 Route Handlers — única API pública
    │   │   ├── products/route.ts
    │   │   ├── products/[id]/route.ts
    │   │   ├── categories/route.ts
    │   │   ├── cart/route.ts
    │   │   ├── orders/route.ts
    │   │   └── admin/
    │   │       ├── metrics/route.ts
    │   │       ├── roles/route.ts
    │   │       ├── permissions/route.ts
    │   │       └── audit-logs/route.ts
    │   ├── layout.tsx           root: fonts, ClerkProvider, Providers
    │   ├── globals.css
    │   └── not-found.tsx
    │
    ├── modules/                 FEATURES por dominio (lado cliente)
    │   └── <dominio>/           products | categories | cart | orders | customers | dashboard | roles | audit
    │       ├── components/      UI específica del dominio
    │       ├── hooks/           TanStack Query: useProducts, useCreateProduct
    │       ├── services/        llamadas axios tipadas (product.service.ts)
    │       ├── schemas/         Zod: entrada/salida del dominio
    │       ├── store/           Zustand, solo si el dominio tiene estado UI global
    │       ├── types/           tipos derivados del schema Drizzle
    │       └── constants.ts
    │
    ├── server/                  SOLO servidor — nunca importar desde cliente
    │   ├── db/
    │   │   ├── index.ts         cliente Drizzle + Neon
    │   │   ├── schema/          una tabla por archivo + index.ts barrel
    │   │   └── seed.ts
    │   ├── repositories/        acceso a datos (product.repository.ts)
    │   └── services/            reglas de negocio que cruzan repositorios
    │
    ├── components/
    │   ├── ui/                  shadcn — no editar a mano salvo tokens
    │   ├── shared/              header, footer, sidebar, data-table, empty-state
    │   └── providers/           query-provider, theme-provider
    │
    ├── lib/
    │   ├── axios.ts             instancia única con baseURL e interceptores
    │   ├── query-client.ts      config de TanStack Query
    │   ├── utils.ts             cn() y helpers puros
    │   ├── auth.ts              helpers de Clerk: requireAuth, requireAdmin
    │   ├── permissions.ts       PERMISSIONS (códigos), can(), requirePermission()
    │   ├── audit.ts             logAudit() — escribe en audit_logs dentro de la tx
    │   └── constants.ts
    │
    ├── hooks/                   hooks transversales (useDebounce, useMediaQuery)
    ├── types/                   tipos globales compartidos
    └── middleware.ts            Clerk: rutas públicas vs protegidas vs admin
```

### Convenciones de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivo de componente | kebab-case | `product-card.tsx` |
| Componente | PascalCase | `ProductCard` |
| Hook | `use` + camelCase | `useProducts` |
| Service | `<dominio>.service.ts` | `product.service.ts` |
| Repositorio | `<dominio>.repository.ts` | `product.repository.ts` |
| Schema Drizzle | singular | `src/server/db/schema/product.ts` |
| Tabla en Postgres | snake_case plural | `products`, `order_items` |
| Route Handler | `route.ts` | `app/api/products/route.ts` |

---

## 4. Flujo de datos

```
Server Component ──────────────────────► repositorio ──► Drizzle ──► Neon
   (lectura inicial, SEO)

Client Component ──► hook (TanStack Query) ──► service (axios)
                                                     │
                                                     ▼
                                          Route Handler (/api)
                                             · Clerk auth
                                             · validación Zod
                                             · repositorio ──► Drizzle ──► Neon
```

**Reglas duras**

1. Un componente **nunca** importa `db`, Drizzle ni un repositorio.
2. Un componente **nunca** llama `axios`/`fetch` directo. Va en `services/`, se consume vía hook.
3. Toda consulta a BD vive en `src/server/repositories/`. Los Route Handlers orquestan, no consultan.
4. Todo Route Handler valida su entrada con Zod antes de llamar al repositorio.
5. Los tipos se **infieren** del schema Drizzle (`InferSelectModel`), no se escriben dos veces.
6. Datos de servidor → TanStack Query. Estado de UI (carrito local, filtros, sidebar) → Zustand. Sin mezclar.
7. `"use client"` lo más abajo posible en el árbol. Nunca en un layout que no lo necesita.

---

## 5. Modelo de datos inicial

El detalle exacto de cada tabla lo define su spec. Precios en **enteros
(centavos)**. Nunca `float`.

### 5.1 Identidad y acceso (RBAC)

| Tabla | Propósito | Relaciones |
|---|---|---|
| `users` | espejo local de Clerk: `clerk_id` (único), email, nombre, `is_active` | N—N `roles`, 1—N `orders`, 1—N `audit_logs` |
| `roles` | rol nombrado: `slug` (`super_admin`, `admin`, `manager`, `employee`, `customer`, `audit`), nombre, descripción, `is_system` | N—N `users`, N—N `permissions` |
| `permissions` | permiso atómico: `code` único `<recurso>.<acción>` (`products.create`, `orders.update_status`), `resource`, `action`, descripción | N—N `roles` |
| `role_permissions` | pivote rol ↔ permiso. PK compuesta (`role_id`, `permission_id`) | N—1 `roles`, N—1 `permissions` |
| `user_roles` | pivote usuario ↔ rol. PK compuesta (`user_id`, `role_id`), `assigned_by`, `assigned_at` | N—1 `users`, N—1 `roles` |

**Cómo convive con Clerk**

- Clerk es la fuente de verdad de la **autenticación** (sesión, credenciales, MFA).
- Postgres es la fuente de verdad de la **autorización** (roles y permisos del dominio).
- `users` se sincroniza desde Clerk vía webhook (`user.created`, `user.updated`, `user.deleted`).
- El set de permisos efectivo se resuelve en servidor: `clerk_id → users → user_roles → role_permissions → permissions`.
- Cachear el set de permisos en `publicMetadata` de Clerk es opcional y **derivado**; ante discrepancia, gana Postgres.

**Reglas duras**

1. La verificación se hace siempre por `permission.code`, nunca por nombre de rol
   quemado en el código (`if (role === 'admin')` es un hallazgo bloqueante).
2. Los roles de sistema (`is_system = true`) no se borran ni se renombran desde la UI.
3. Un usuario sin filas en `user_roles` es `customer` por defecto. Ese default vive
   en un solo lugar del servidor, no repartido por la app.
4. `permissions` es una tabla semilla (`db:seed`), no editable desde el panel. Los
   permisos nacen del código; los roles se componen desde la UI.

**Roles de sistema** (`src/modules/roles/constants.ts`, sembrados con `is_system = true`)

| Slug | Permisos |
|---|---|
| `super_admin` | Todos. Único con `roles.create/update/delete/manage_permissions` |
| `admin` | Todos salvo esos cuatro; conserva `roles.read`, `users.*` y `audit.read` |
| `manager` | `admin.access`, `dashboard.read`, `categories.*`, `products.*`, `users.read`, `audit.read` |
| `employee` | `admin.access`, `dashboard.read`, `categories.read`, `products.read/create/update` |
| `audit` | `admin.access`, `dashboard.read`, `categories.read`, `products.read`, `roles.read`, `users.read`, `audit.read` |
| `customer` | Ninguno. Default de todo usuario sin filas en `user_roles` |

`super_admin` y `admin` se distinguen **solo por su set de permisos**. Un
`if (role === 'super_admin')` en el código es un hallazgo bloqueante: la
autorización siempre pasa por `requirePermission(PERMISSIONS.*)` / `can()`.

Los slugs retirados del catálogo se declaran en `RETIRED_ROLE_SLUGS`. `db:seed`
los elimina solo si no tienen usuarios asignados (`user_roles` los referencia con
`onDelete: restrict`): si los tienen, avisa por consola y continúa.

### 5.2 Auditoría y logs

| Tabla | Propósito | Relaciones |
|---|---|---|
| `audit_logs` | traza inmutable de toda mutación relevante | N—1 `users` (`actor_id`, nullable) |

Columnas:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `actor_id` | fk `users.id` nullable | null = acción del sistema, cron o webhook |
| `action` | text | `product.created`, `order.status_changed`, `role.permission_granted`, `auth.login_failed` |
| `entity_type` | text | `product`, `order`, `user`, `role` |
| `entity_id` | text nullable | id del registro afectado |
| `changes` | jsonb nullable | `{ before, after }` — solo los campos que cambiaron |
| `metadata` | jsonb nullable | contexto extra (ruta, motivo, id de request) |
| `ip_address` | inet nullable | |
| `user_agent` | text nullable | |
| `severity` | enum | `info` \| `warning` \| `error` |
| `created_at` | timestamptz | default `now()` |

Índices: `(entity_type, entity_id)`, `(actor_id, created_at desc)`, `(action)`,
`(created_at desc)`.

**Reglas duras**

1. `audit_logs` es **append-only**. Sin `UPDATE`, sin `DELETE` desde la aplicación.
   El único borrado permitido es la purga por retención (job, no request de usuario).
2. Se escribe en la **misma transacción** que la mutación auditada. Si la mutación
   revierte, el log también.
3. Nunca se guarda PII sensible ni secretos en `changes` o `metadata`: sin
   contraseñas, tokens, claves de API ni datos de tarjeta. Los campos sensibles se
   enmascaran antes de serializar.
4. Un fallo al escribir el log **no** debe romper la operación de negocio salvo que
   la acción sea de seguridad (cambio de rol o permiso), donde sí es transaccional
   y bloqueante.
5. Retención sugerida: 180 días para `info`, indefinida para acciones de seguridad.

> `audit_logs` cubre también los eventos de autenticación y de seguridad mediante
> el prefijo de `action` (`auth.*`, `role.*`). Se separa en una tabla propia solo
> si el volumen o los patrones de consulta divergen de verdad.

### 5.3 Catálogo y ventas

| Tabla | Propósito | Relaciones |
|---|---|---|
| `categories` | taxonomía de productos | 1—N `products` |
| `products` | SKU, nombre, slug, precio, stock, specs | N—1 `categories` |
| `product_images` | galería | N—1 `products` |
| `carts` / `cart_items` | carrito persistido | N—1 `users`, `products` |
| `orders` | cabecera: total, estado, dirección | N—1 `users` |
| `order_items` | detalle con precio congelado | N—1 `orders`, `products` |

---

## 6. Módulos funcionales

### Cliente (storefront)
Catálogo con filtros y búsqueda · ficha de producto · carrito · checkout ·
historial y detalle de pedidos · perfil (Clerk).

### Administración
Dashboard con métricas (Recharts: ventas, pedidos, top productos, stock bajo) ·
CRUD de productos y categorías (TanStack Table: paginación, orden, filtros) ·
gestión de pedidos y cambio de estado · listado de clientes.

Gestión de accesos: CRUD de roles, matriz rol × permiso, asignación de roles a
usuarios · bitácora de auditoría filtrable por actor, entidad, acción y fecha.

Acceso admin protegido en dos capas: `middleware.ts` (borde) y verificación por
**código de permiso** en cada Route Handler bajo `/api/admin/`
(`requirePermission('products.create')`), nunca por nombre de rol.

---

## 7. Sincronización Clerk ↔ Postgres

Clerk es la fuente de verdad de la autenticación; `users` es su espejo local y la
base de la autorización. Hay dos caminos y se complementan:

| Camino | Cubre | Comando |
|---|---|---|
| **Backfill** (Clerk Backend API) | Usuarios que ya existían antes de montar el webhook | `npm run db:sync-users` |
| **Webhook** (`user.created/updated/deleted`) | Altas y cambios en vivo | `POST /api/webhooks/clerk` |

Ambos escriben con la misma lógica (`applyUserUpsert()` en
`src/server/services/user-sync.service.ts`) y auditan en la misma transacción.
Se distinguen en `audit_logs.metadata.source`: `clerk_backfill` o `clerk_webhook`.
Los dos son idempotentes: correrlos dos veces no duplica filas.

### 7.1 Puesta en marcha (orden)

| # | Quién | Paso |
|---|---|---|
| 1 | automatizable | `npm run db:migrate && npm run db:seed` — crea permisos y los 6 roles de sistema |
| 2 | automatizable | `npm run db:sync-users` — trae los usuarios ya existentes en Clerk |
| 3 | automatizable | `npm run db:seed` otra vez — ahora `SEED_ADMIN_EMAIL` ya existe en `users` y recibe `super_admin` |
| 4 | **manual** | Configurar el webhook de desarrollo (§7.2) |

El paso 3 no es un truco: `seedAdminAssignment()` solo puede asignar el rol si el
usuario ya está sincronizado. Con el webhook activo, las altas posteriores no lo
necesitan.

### 7.2 Webhook en desarrollo — pasos manuales

`localhost` no es alcanzable desde Clerk. En vez de un túnel externo se usa el
**relay propio de Clerk**, que preserva los headers `svix-*`, así que
`verifyWebhook()` no cambia. Estos cuatro pasos los ejecuta **el usuario**; no son
automatizables (la CLI es interactiva y de larga duración, y el signing secret
solo se ve en el Dashboard).

1. Con `npm run dev` arriba, en **otra terminal**:

   ```bash
   npm run webhooks:listen
   ```

   Imprime una relay URL del tipo `https://webhooks.clerk.com/in/c_xxxxxxxx/`.
   Deja esa terminal abierta mientras desarrolles.

   Para **fijar la relay URL entre reinicios**, pásale un token estable:

   ```bash
   # bash / zsh
   npx -y clerk@latest webhooks listen \
     --token "$(npx -y clerk@latest webhooks token)" \
     --forward-to http://localhost:3000/api/webhooks/clerk
   ```

   ```powershell
   # PowerShell (Windows)
   $token = npx -y clerk@latest webhooks token
   npx -y clerk@latest webhooks listen --token "$token" --forward-to http://localhost:3000/api/webhooks/clerk
   ```

   `npm run webhooks:token` imprime ese token; guárdalo para reusar la misma URL.

2. En el **Clerk Dashboard → Webhooks → Add Endpoint**, registra la relay URL y
   suscribe `user.created`, `user.updated` y `user.deleted`.

3. Copia el **Signing Secret** (`whsec_…`) de ese endpoint y pégalo en `.env.local`:

   ```bash
   CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
   ```

4. Reinicia `npm run dev` (las variables de entorno se leen al arrancar).

Verificación: crea un usuario desde `/sign-up`; debe aparecer en `users` sin
correr `db:sync-users`, con un `audit_logs` de `metadata.source = 'clerk_webhook'`.

> En producción el endpoint es la URL pública real (`https://<dominio>/api/webhooks/clerk`),
> con su propio signing secret. El relay es solo para desarrollo.

---

## 8. Testing unitario

Convención de ubicación y nombres para las pruebas unitarias. No requiere
dependencias de terceros: corre con el test runner nativo de Node (`node --test`,
disponible desde Node 22+, con soporte de TypeScript sin flags adicionales).

El inventario de qué funciones son unit-testeables hoy (y cuáles quedan fuera
a propósito) vive en **[docs/testing/unit-test-candidates.md](testing/unit-test-candidates.md)**;
esa es la fuente de verdad para decidir qué archivo lleva test.

### 8.1 Dónde viven los tests

**Colocation**: el test vive junto al archivo que prueba, mismo directorio y
mismo nombre base, con sufijo `.test.ts`. Nada de carpetas paralelas `tests/`
ni `__tests__/`.

```
src/
├── lib/
│   ├── utils.ts
│   ├── utils.test.ts
│   ├── audit.ts
│   ├── audit.test.ts
│   ├── api-error.ts
│   └── api-error.test.ts
│
├── modules/
│   └── <dominio>/               products | categories | cart | orders | payment-methods | roles | audit | checkout
│       ├── schemas/
│       │   ├── <dominio>.schema.ts
│       │   └── <dominio>.schema.test.ts
│       ├── types/
│       │   ├── index.ts
│       │   └── index.test.ts
│       ├── store/                          solo si el dominio tiene store (ej. cart)
│       │   ├── <dominio>-store.ts
│       │   └── <dominio>-store.test.ts
│       ├── utils.ts                        solo si el dominio lo tiene (ej. orders)
│       └── utils.test.ts
│
└── server/
    └── services/
        ├── <dominio>.service.ts
        └── <dominio>.service.test.ts       solo si el archivo tiene lógica pura (ver nota)
```

Solo se crea `*.test.ts` para un archivo que aparece listado en
`docs/testing/unit-test-candidates.md`. Un archivo sin funciones puras —
componentes, hooks React, Route Handlers, `middleware.ts`, repositorios, o los
`*.service.ts` de `modules/*/services` que solo envuelven `axios` — no lleva
test unitario junto a él.

### 8.2 Convención de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivo de test | `<nombre-del-archivo>.test.ts` | `utils.test.ts`, `product.schema.test.ts` |
| Bloque de agrupación | `describe("<función o schema>")` | `describe("toCents")` |
| Caso de prueba | `it("<comportamiento esperado>")` | `it("redondea .995 hacia arriba")` |

### 8.3 Cómo se corren

```bash
node --test "src/**/*.test.ts"
```

Cuando el equipo decida fijarlo, el script sugerido en `package.json` es
`"test:unit": "node --test \"src/**/*.test.ts\""`. Este documento solo fija la
convención; no instala ni configura nada todavía.

---

## 9. Checklist de arranque

- [ ] `create-next-app` ejecutado con las flags de la sección 2
- [ ] Dependencias instaladas
- [ ] Proyecto Neon creado y `DATABASE_URL` en `.env.local`
- [ ] `drizzle.config.ts` apuntando a `src/server/db/schema`
- [ ] Aplicación Clerk creada y claves en `.env.local`
- [ ] `middleware.ts` con rutas públicas, protegidas y de admin
- [ ] Webhook de Clerk (`user.created/updated/deleted`) sincronizando `users` (§7.2)
- [ ] Seed de `permissions` y roles de sistema ejecutado (`npm run db:seed`)
- [ ] Backfill de usuarios de Clerk ejecutado (`npm run db:sync-users`)
- [ ] `SEED_ADMIN_EMAIL` con rol `super_admin` en `user_roles`
- [ ] `ClerkProvider` + `QueryProvider` en `src/app/layout.tsx`
- [ ] `shadcn init` ejecutado y componentes base agregados
- [ ] Estructura de carpetas de la sección 3 creada
- [ ] `npm run typecheck`, `npm run lint` y `npm run build` en verde
