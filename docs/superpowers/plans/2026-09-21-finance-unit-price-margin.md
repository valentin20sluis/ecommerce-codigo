# Finanzas — Fase 1: Precio unitario (costo y margen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar costo unitario por producto y margen de catálogo al panel de admin, y empezar a congelar ese costo en cada línea de pedido para que fases futuras del módulo de Finanzas puedan calcular el margen realmente ganado por venta.

**Architecture:** Dos columnas nuevas (`products.cost_cents`, `order_items.cost_cents_snapshot`), un módulo cliente nuevo `src/modules/finance/` calcado del patrón de `src/modules/inventory/`, un cálculo puro de margen (`src/server/services/finance.math.ts`, testeado como `inventory.math.ts`), y un endpoint de lectura paginada + uno de edición de costo, ambos detrás de dos permisos nuevos (`finance.read`, `finance.manage_costs`). El checkout existente (`checkout.service.ts`) se toca en un solo punto para congelar el costo junto al precio.

**Tech Stack:** Next.js 16 (Route Handlers) · Drizzle ORM / Neon Postgres · Zod · TanStack Query v5 · TanStack Table v8 · React Hook Form · shadcn/ui · Node test runner (`node --test`).

**Spec:** `docs/specs/015-finance-unit-price-margin.md`

## Global Constraints

- Precios y costos siempre en centavos enteros; nunca `float`.
- TypeScript estricto: cero `any`, cero `@ts-ignore`.
- Un componente nunca importa `db`, Drizzle ni un repositorio directamente.
- Un componente nunca llama `axios`/`fetch` directo: va en `services/` del módulo, se consume vía hook de TanStack Query.
- Toda consulta a BD vive en `src/server/repositories/`; los Route Handlers orquestan, no consultan.
- Todo Route Handler valida su entrada con Zod antes de tocar datos.
- Los tipos se infieren del schema Drizzle (`InferSelectModel`/`InferInsertModel`), no se duplican a mano.
- La autorización siempre pasa por `requirePermission(PERMISSIONS.*)` / `can()`; nunca se compara `role === '...'` en el código.
- `audit_logs` es append-only y se escribe en la **misma transacción** que la mutación auditada; sin PII ni secretos en el log.
- Gestor de paquetes: **npm**. Verificación final de todo el plan: `npm run typecheck && npm run lint && npm run build && npm test`.

## Review Focus

- `costCents = null` en un producto: el margen debe mostrarse y viajar como "sin dato" (`null`), nunca como `0%` o `NaN` — pinneado en Task 3.
- Margen negativo (costo mayor que el precio): debe calcularse y mostrarse tal cual, sin clamplear a cero ni ocultarse — pinneado en Task 3.
- `PATCH .../unit-price/[productId]` con `costCents: null`: debe **borrar** un costo ya cargado, no rechazarse como inválido ni ignorarse en silencio — pinneado en Task 7.
- Un usuario con `finance.read` pero sin `finance.manage_costs`: el PATCH debe responder 403 y la UI no debe ofrecer la acción de editar costo — pinneado en Tasks 8 y 12.
- `cost_cents_snapshot` de una línea de pedido: debe quedar fijo con el costo del producto en el momento de crear la sesión de checkout, y no debe releerse ni recalcularse si el costo del producto cambia después — pinneado en Task 6 (sin test automatizado posible: `checkout.service.ts` está fuera del alcance de unit testing del proyecto, ver `docs/testing/unit-test-candidates.md` §10; se verifica manualmente en el paso de la propia tarea).

---

### Task 1: Esquema — costo por producto y snapshot en pedidos

**Files:**
- Modify: `src/server/db/schema/product.ts`
- Modify: `src/server/db/schema/order-item.ts`
- Create: `drizzle/00XX_<nombre-generado>.sql` (lo genera `drizzle-kit`, no se escribe a mano)

**Interfaces:**
- Consumes: nada (es la base del resto del plan).
- Produces: `products.costCents: number | null` (tipo `Product`/`NewProduct` inferido). `orderItems.costCentsSnapshot: number | null` (tipo `OrderItem`/`NewOrderItem` inferido).

- [ ] **Step 1: Agregar la columna `cost_cents` a `products`**

En `src/server/db/schema/product.ts`, dentro de la definición de `products` (`pgTable`), agrega el campo justo después de `compareAtPriceCents`:

```ts
    priceCents: integer("price_cents").notNull(),
    compareAtPriceCents: integer("compare_at_price_cents"),
    /** Costo unitario actual (015 D1). Nullable a propósito: sin costo cargado,
     * el margen se muestra como "sin dato", nunca como un 0 o un 100% falso. */
    costCents: integer("cost_cents"),
    stock: integer("stock").notNull().default(0),
```

- [ ] **Step 2: Agregar la columna `cost_cents_snapshot` a `order_items`**

En `src/server/db/schema/order-item.ts`, dentro de `orderItems`, agrega el campo después de `unitPriceCents`:

```ts
    /** Precio congelado en centavos; nunca se relee de `products` después. */
    unitPriceCents: integer("unit_price_cents").notNull(),
    /** Costo congelado al momento de la venta (015 D2). Si el producto no tenía
     * costo cargado, queda NULL para siempre: no se rellena retroactivamente. */
    costCentsSnapshot: integer("cost_cents_snapshot"),
    qty: integer("qty").notNull(),
```

- [ ] **Step 3: Generar la migración**

Run: `npm run db:generate`

Expected: drizzle-kit crea un archivo nuevo en `drizzle/` con dos `ALTER TABLE`, aproximadamente:

```sql
ALTER TABLE "products" ADD COLUMN "cost_cents" integer;
ALTER TABLE "order_items" ADD COLUMN "cost_cents_snapshot" integer;
```

No hace falta editarlo a mano: ambas columnas nacen `NULL`-eables, sin backfill (015 D1/D2, a diferencia de 014).

- [ ] **Step 4: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores. `Product`, `NewProduct`, `OrderItem`, `NewOrderItem` ahora incluyen los campos nuevos automáticamente (inferidos del schema).

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema/product.ts src/server/db/schema/order-item.ts drizzle/
git commit -m "feat(db): add cost_cents to products and cost_cents_snapshot to order_items"
```

---

### Task 2: Permisos `finance.read` / `finance.manage_costs`

**Files:**
- Modify: `src/lib/permissions.catalog.ts`
- Modify: `src/modules/roles/constants.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `PERMISSIONS.FINANCE_READ: "finance.read"`, `PERMISSIONS.FINANCE_MANAGE_COSTS: "finance.manage_costs"`.

- [ ] **Step 1: Agregar los códigos al catálogo**

En `src/lib/permissions.catalog.ts`, dentro del objeto `PERMISSIONS`, agrega las dos claves nuevas justo después de `INVENTORY_ADJUST`:

```ts
  INVENTORY_READ: "inventory.read",
  INVENTORY_ADJUST: "inventory.adjust",
  FINANCE_READ: "finance.read",
  FINANCE_MANAGE_COSTS: "finance.manage_costs",
  ROLES_READ: "roles.read",
```

Y sus descripciones en `PERMISSION_DESCRIPTIONS`, en el mismo orden relativo:

```ts
  [PERMISSIONS.INVENTORY_READ]: "Ver el inventario y el kardex de cada producto.",
  [PERMISSIONS.INVENTORY_ADJUST]: "Registrar ajustes, mermas y reposiciones de stock.",
  [PERMISSIONS.FINANCE_READ]: "Ver costo, margen y reportes financieros.",
  [PERMISSIONS.FINANCE_MANAGE_COSTS]: "Editar el costo unitario de un producto.",
  [PERMISSIONS.ROLES_READ]: "Ver roles y sus permisos.",
```

- [ ] **Step 2: Asignar el permiso de lectura a `manager` y `audit`**

En `src/modules/roles/constants.ts`, en el rol `manager` (015 D4: ve márgenes, no cambia costos), agrega `PERMISSIONS.FINANCE_READ` después de `PERMISSIONS.INVENTORY_ADJUST`:

```ts
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.FINANCE_READ,
      PERMISSIONS.USERS_READ,
```

En el rol `audit`, agrega `PERMISSIONS.FINANCE_READ` después de `PERMISSIONS.INVENTORY_READ`:

```ts
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.FINANCE_READ,
      PERMISSIONS.ROLES_READ,
```

`super_admin` y `admin` reciben ambos permisos automáticamente vía `ALL_PERMISSIONS` (no se tocan). `employee` no recibe ninguno de los dos (015 D4): no se agrega nada a su lista.

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Sembrar los permisos localmente**

Run: `npm run db:seed`
Expected: el log muestra los dos permisos nuevos dados de alta (o actualizados) y su concesión a `super_admin`, `admin`, `manager` y `audit`, sin tocar `employee`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.catalog.ts src/modules/roles/constants.ts
git commit -m "feat(finance): add finance.read and finance.manage_costs permissions"
```

---

### Task 3: Cálculo puro del margen

**Files:**
- Create: `src/server/services/finance.math.ts`
- Test: `src/server/services/finance.math.test.ts`

**Interfaces:**
- Consumes: nada (función pura, sin dependencias del proyecto).
- Produces: `computeMargin(priceCents: number, costCents: number | null): { marginCents: number | null; marginPercent: number | null }`.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/server/services/finance.math.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeMargin } from "./finance.math.ts";

describe("computeMargin", () => {
  it("returns null margin when there is no cost loaded", () => {
    assert.deepEqual(computeMargin(10000, null), { marginCents: null, marginPercent: null });
  });

  it("computes margin cents and percent for a typical product", () => {
    assert.deepEqual(computeMargin(10000, 6000), { marginCents: 4000, marginPercent: 40 });
  });

  it("rounds marginPercent to one decimal", () => {
    assert.deepEqual(computeMargin(3000, 1000), { marginCents: 2000, marginPercent: 66.7 });
  });

  it("returns a negative margin when cost is above price, without clamping", () => {
    assert.deepEqual(computeMargin(1000, 1500), { marginCents: -500, marginPercent: -50 });
  });

  it("treats a zero cost as a real cost, not as 'no data'", () => {
    assert.deepEqual(computeMargin(1000, 0), { marginCents: 1000, marginPercent: 100 });
  });

  it("does not divide by zero when priceCents is zero", () => {
    assert.deepEqual(computeMargin(0, 0), { marginCents: 0, marginPercent: 0 });
  });
});
```

- [ ] **Step 2: Ejecutar el test y confirmar que falla**

Run: `node --test "src/server/services/finance.math.test.ts"`
Expected: FAIL — `Cannot find module './finance.math.ts'` (o similar).

- [ ] **Step 3: Implementar `computeMargin`**

Crea `src/server/services/finance.math.ts`:

```ts
export type Margin = { marginCents: number | null; marginPercent: number | null };

/**
 * Margen de catálogo (015 D5): si no hay costo cargado, ninguno de los dos
 * valores se calcula — un `costCents: null` no es un costo de `0`, así que no
 * se puede confundir un margen del 100% con la ausencia total del dato.
 * `marginPercent` se redondea a un decimal para la tabla del panel.
 */
export function computeMargin(priceCents: number, costCents: number | null): Margin {
  if (costCents === null) return { marginCents: null, marginPercent: null };

  const marginCents = priceCents - costCents;
  const marginPercent = priceCents === 0 ? 0 : Math.round((marginCents / priceCents) * 1000) / 10;

  return { marginCents, marginPercent };
}
```

- [ ] **Step 4: Ejecutar el test y confirmar que pasa**

Run: `node --test "src/server/services/finance.math.test.ts"`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/finance.math.ts src/server/services/finance.math.test.ts
git commit -m "feat(finance): add pure margin calculation with tests"
```

---

### Task 4: Repositorio — listado y edición de costo

**Files:**
- Modify: `src/server/repositories/product.repository.ts`

**Interfaces:**
- Consumes: `products` (schema, Task 1), `Executor`/`ReadExecutor` (`@/server/db/pool`).
- Produces: `productRepository.listUnitPrices(params: UnitPriceParams, executor?): Promise<{ data: UnitPriceRow[]; total: number }>`, `productRepository.updateCost(executor: Executor, id: string, costCents: number | null): Promise<Product | null>`, tipos `UnitPriceParams`, `UnitPriceRow`.

- [ ] **Step 1: Agregar los tipos y funciones al final de `product.repository.ts`**

Agrega al final del archivo (después de `listInventory`):

```ts
export type UnitPriceParams = {
  q?: string;
  page: number;
  pageSize: number;
};

/** Fila del listado de Finanzas: solo lo necesario para precio, costo y margen. */
export type UnitPriceRow = Pick<Product, "id" | "name" | "sku" | "priceCents" | "costCents">;

/**
 * Listado del módulo de Finanzas (015). Sin join de categoría: el reporte de
 * margen no la necesita. Una consulta por página más el `count(*)`.
 */
export async function listUnitPrices(
  params: UnitPriceParams,
  executor: ReadExecutor = db,
): Promise<{ data: UnitPriceRow[]; total: number }> {
  const conditions: SQL[] = [];

  const term = params.q?.trim();
  if (term) {
    const pattern = `%${term}%`;
    const match = or(ilike(products.name, pattern), ilike(products.sku, pattern));
    if (match) conditions.push(match);
  }

  const filter = conditions.length > 0 ? and(...conditions) : undefined;

  const columns = {
    id: products.id,
    name: products.name,
    sku: products.sku,
    priceCents: products.priceCents,
    costCents: products.costCents,
  };

  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(filter);

  const data = await executor
    .select(columns)
    .from(products)
    .where(filter)
    .orderBy(asc(products.name))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  return { data, total };
}

/** Edición de costo (015 D3): `costCents: null` borra un costo cargado por error. */
export async function updateCost(
  executor: Executor,
  id: string,
  costCents: number | null,
): Promise<Product | null> {
  const [row] = await executor
    .update(products)
    .set({ costCents, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  return row ?? null;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores. Todos los imports (`and`, `ilike`, `or`, `sql`, `asc`, `eq`, `type SQL`, `db`, `Executor`, `ReadExecutor`, `products`, `Product`) ya están en el archivo (ver cabecera de `product.repository.ts`); no hace falta agregar ningún import nuevo.

- [ ] **Step 3: Commit**

```bash
git add src/server/repositories/product.repository.ts
git commit -m "feat(finance): add listUnitPrices and updateCost to product repository"
```

---

### Task 5: Servicio — edición de costo con auditoría

**Files:**
- Create: `src/server/services/finance.service.ts`

**Interfaces:**
- Consumes: `productRepository.findById`, `productRepository.updateCost` (Task 4); `dbTx` (`@/server/db/pool`); `logAudit` (`@/lib/audit`); `NotFoundError` (`@/lib/api-error`).
- Produces: `updateProductCost(actor: User, productId: string, costCents: number | null): Promise<Product>` (lanza `NotFoundError` si el producto no existe).

- [ ] **Step 1: Crear el servicio**

Crea `src/server/services/finance.service.ts`:

```ts
import { NotFoundError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { dbTx } from "@/server/db/pool";
import type { Product, User } from "@/server/db/schema";
import * as productRepository from "@/server/repositories/product.repository";

const PRODUCT_ENTITY = "product";

/**
 * Edición de costo (015 D3/D6): transacción propia con su propia auditoría,
 * separada de `product.service.ts` porque el costo es un dato de Finanzas, no
 * de catálogo. `costCents: null` es una edición válida: borra un costo
 * cargado por error en vez de dejarlo en `0` (que se leería como margen 100%).
 */
export async function updateProductCost(
  actor: User,
  productId: string,
  costCents: number | null,
): Promise<Product> {
  return dbTx.transaction(async (tx) => {
    const product = await productRepository.findById(productId, tx);
    if (!product) throw new NotFoundError("El producto no existe.");

    const updated = await productRepository.updateCost(tx, productId, costCents);
    if (!updated) throw new NotFoundError("El producto no existe.");

    await logAudit(tx, {
      actorId: actor.id,
      action: "finance.cost_updated",
      entityType: PRODUCT_ENTITY,
      entityId: productId,
      changes: {
        before: { costCents: product.costCents },
        after: { costCents: updated.costCents },
      },
    });

    return updated;
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/finance.service.ts
git commit -m "feat(finance): add updateProductCost service with audit logging"
```

---

### Task 6: Congelar el costo en el checkout

**Files:**
- Modify: `src/server/repositories/order.repository.ts`
- Modify: `src/server/services/checkout.service.ts`

**Interfaces:**
- Consumes: `order_items.costCentsSnapshot` (Task 1), `Product.costCents` (Task 1).
- Produces: `OrderItemValues` ahora incluye `costCentsSnapshot`; cada línea de pedido creada por `createCheckoutSession` congela el costo del producto en ese instante.

- [ ] **Step 1: Ampliar `OrderItemValues`**

En `src/server/repositories/order.repository.ts`, cambia:

```ts
export type OrderItemValues = Pick<
  NewOrderItem,
  "productId" | "nameSnapshot" | "unitPriceCents" | "qty"
>;
```

por:

```ts
export type OrderItemValues = Pick<
  NewOrderItem,
  "productId" | "nameSnapshot" | "unitPriceCents" | "costCentsSnapshot" | "qty"
>;
```

`createWithItems` no necesita ningún otro cambio: ya hace `items.map((item) => ({ ...item, orderId: order.id }))`, así que el campo nuevo viaja solo.

- [ ] **Step 2: Congelar el costo al resolver las líneas del checkout**

En `src/server/services/checkout.service.ts`, dentro de `resolveLines`, en el `return items.map(...)` final, agrega la línea `costCentsSnapshot`:

```ts
  return items.map((item) => {
    const product = cache.get(item.productId)!;

    return {
      productId: product.id,
      nameSnapshot: product.name,
      unitPriceCents: product.priceCents,
      // 015 D2: mismo instante en que se congela el precio. Si el producto no
      // tenía costo cargado, queda NULL para siempre — no se recalcula después.
      costCentsSnapshot: product.costCents,
      qty: item.qty,
    };
  });
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Verificación manual (015 D2/AC6/AC7 — sin test automatizado, ver Review Focus)**

`checkout.service.ts` mezcla lógica de negocio con transacciones de Drizzle y llamadas a Stripe, por lo que queda fuera del alcance de unit testing del proyecto (`docs/testing/unit-test-candidates.md` §10). Verifica a mano con `npm run dev`:

1. Carga un costo a un producto desde `/admin/finance/unit-price` (una vez completada la Task 12; si esta tarea se ejecuta antes, usa `db:studio` para escribir `cost_cents` a mano en esa fila).
2. Compra ese producto (checkout de prueba con Stripe test mode).
3. En `db:studio`, confirma que la fila de `order_items` de esa compra tiene `cost_cents_snapshot` igual al costo del producto en ese momento.
4. Cambia el costo del producto (o bórralo). Confirma que el `cost_cents_snapshot` de la línea ya comprada **no cambia**.

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/order.repository.ts src/server/services/checkout.service.ts
git commit -m "feat(finance): freeze product cost into order_items at checkout"
```

---

### Task 7: Schemas Zod y DTO del módulo

**Files:**
- Create: `src/modules/finance/schemas/unit-price.schema.ts`
- Test: `src/modules/finance/schemas/unit-price.schema.test.ts`
- Create: `src/modules/finance/types/finance.ts`

**Interfaces:**
- Consumes: `toCents` (`@/lib/utils`), `computeMargin` (Task 3), `UnitPriceRow` (Task 4, type-only), `Paginated` (`@/types/api`).
- Produces: `unitPriceQuerySchema`, `UnitPriceQuery`, `updateCostSchema`, `UpdateCostInput`, `costFormSchema`, `CostFormValues`, `toUpdateCostInput(values: CostFormValues): UpdateCostInput`; `UnitPriceRowDto`, `UnitPriceListResponse`, `toUnitPriceRowDto(row: UnitPriceRow): UnitPriceRowDto`.

- [ ] **Step 1: Escribir el test que falla**

Crea `src/modules/finance/schemas/unit-price.schema.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { costFormSchema, toUpdateCostInput, updateCostSchema } from "./unit-price.schema.ts";

describe("updateCostSchema", () => {
  it("accepts a positive integer cost", () => {
    assert.equal(updateCostSchema.safeParse({ costCents: 6000 }).success, true);
  });

  it("accepts an explicit null to clear the cost", () => {
    const result = updateCostSchema.safeParse({ costCents: null });
    assert.equal(result.success, true);
    assert.equal(result.data?.costCents, null);
  });

  it("rejects a negative cost", () => {
    assert.equal(updateCostSchema.safeParse({ costCents: -1 }).success, false);
  });

  it("rejects a non-integer cost", () => {
    assert.equal(updateCostSchema.safeParse({ costCents: 12.5 }).success, false);
  });
});

describe("costFormSchema", () => {
  it("accepts an empty string as 'no cost'", () => {
    assert.equal(costFormSchema.safeParse({ cost: "" }).success, true);
  });

  it("accepts a decimal amount with a comma", () => {
    assert.equal(costFormSchema.safeParse({ cost: "19,99" }).success, true);
  });

  it("rejects text that is not a number", () => {
    assert.equal(costFormSchema.safeParse({ cost: "abc" }).success, false);
  });
});

describe("toUpdateCostInput", () => {
  it("converts an empty string to a null cost", () => {
    assert.deepEqual(toUpdateCostInput({ cost: "" }), { costCents: null });
  });

  it("converts a decimal amount to integer cents", () => {
    assert.deepEqual(toUpdateCostInput({ cost: "19.99" }), { costCents: 1999 });
  });

  it("converts a comma decimal to integer cents", () => {
    assert.deepEqual(toUpdateCostInput({ cost: "19,99" }), { costCents: 1999 });
  });
});
```

- [ ] **Step 2: Ejecutar el test y confirmar que falla**

Run: `node --test "src/modules/finance/schemas/unit-price.schema.test.ts"`
Expected: FAIL — `Cannot find module './unit-price.schema.ts'`.

- [ ] **Step 3: Implementar el schema**

Crea `src/modules/finance/schemas/unit-price.schema.ts`:

```ts
import { z } from "zod";

import { toCents } from "@/lib/utils";

export const unitPriceQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type UnitPriceQuery = z.infer<typeof unitPriceQuerySchema>;

/** `costCents: null` es una entrada válida (015 D1/D3): borra el costo cargado. */
export const updateCostSchema = z.object({
  costCents: z.number().int().min(0).nullable(),
});

export type UpdateCostInput = z.infer<typeof updateCostSchema>;

/** El formulario no es la API: captura el costo como texto ("19.99"); "" = sin costo. */
export const costFormSchema = z.object({
  cost: z.union([
    z.literal(""),
    z.string().trim().regex(/^\d+([.,]\d{1,2})?$/, "Usa un número con hasta dos decimales."),
  ]),
});

export type CostFormValues = z.infer<typeof costFormSchema>;

/**
 * Traduce el formulario al contrato de la API con el mismo schema que usará el
 * Route Handler: un formulario válido no puede producir un body inválido,
 * mismo criterio que `toStockMovementInput` (014).
 */
export function toUpdateCostInput(values: CostFormValues): UpdateCostInput {
  if (values.cost === "") return updateCostSchema.parse({ costCents: null });
  return updateCostSchema.parse({ costCents: toCents(values.cost) });
}
```

- [ ] **Step 4: Ejecutar el test y confirmar que pasa**

Run: `node --test "src/modules/finance/schemas/unit-price.schema.test.ts"`
Expected: PASS, 10/10.

- [ ] **Step 5: Crear el DTO y su mapeo**

Crea `src/modules/finance/types/finance.ts`:

```ts
import { computeMargin } from "@/server/services/finance.math";
import type { UnitPriceRow } from "@/server/repositories/product.repository";
import type { Paginated } from "@/types/api";

export type UnitPriceRowDto = {
  productId: string;
  name: string;
  sku: string | null;
  priceCents: number;
  costCents: number | null;
  marginCents: number | null;
  marginPercent: number | null;
};

export type UnitPriceListResponse = Paginated<UnitPriceRowDto>;

export function toUnitPriceRowDto(row: UnitPriceRow): UnitPriceRowDto {
  const { marginCents, marginPercent } = computeMargin(row.priceCents, row.costCents);

  return {
    productId: row.id,
    name: row.name,
    sku: row.sku,
    priceCents: row.priceCents,
    costCents: row.costCents,
    marginCents,
    marginPercent,
  };
}
```

- [ ] **Step 6: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/modules/finance/schemas/unit-price.schema.ts src/modules/finance/schemas/unit-price.schema.test.ts src/modules/finance/types/finance.ts
git commit -m "feat(finance): add unit-price schemas, DTO and margin mapping"
```

---

### Task 8: Route handlers — listado y edición de costo

**Files:**
- Create: `src/app/api/admin/finance/unit-price/route.ts`
- Create: `src/app/api/admin/finance/unit-price/[productId]/route.ts`

**Interfaces:**
- Consumes: `requirePermission`, `PERMISSIONS.FINANCE_READ`, `PERMISSIONS.FINANCE_MANAGE_COSTS` (Task 2); `unitPriceQuerySchema`, `updateCostSchema` (Task 7); `toUnitPriceRowDto`, `UnitPriceListResponse`, `UnitPriceRowDto` (Task 7); `productRepository.listUnitPrices` (Task 4); `updateProductCost` (Task 5); `toErrorResponse` (`@/lib/api-error`).
- Produces: `GET /api/admin/finance/unit-price`, `PATCH /api/admin/finance/unit-price/[productId]`.

- [ ] **Step 1: Handler de listado**

Crea `src/app/api/admin/finance/unit-price/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { unitPriceQuerySchema } from "@/modules/finance/schemas/unit-price.schema";
import { toUnitPriceRowDto, type UnitPriceListResponse } from "@/modules/finance/types/finance";
import * as productRepository from "@/server/repositories/product.repository";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ);

    const query = unitPriceQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const { data, total } = await productRepository.listUnitPrices(query);

    return NextResponse.json<UnitPriceListResponse>({
      data: data.map(toUnitPriceRowDto),
      meta: { page: query.page, pageSize: query.pageSize, total },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: Handler de edición de costo**

Crea `src/app/api/admin/finance/unit-price/[productId]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { updateCostSchema } from "@/modules/finance/schemas/unit-price.schema";
import { toUnitPriceRowDto, type UnitPriceRowDto } from "@/modules/finance/types/finance";
import { updateProductCost } from "@/server/services/finance.service";

type Context = { params: Promise<{ productId: string }> };

async function resolveProductId(context: Context): Promise<string> {
  const { productId } = await context.params;
  return z.uuid().parse(productId);
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_COSTS);

    const productId = await resolveProductId(context);
    const input = updateCostSchema.parse(await request.json());

    const updated = await updateProductCost(actor, productId, input.costCents);

    return NextResponse.json<UnitPriceRowDto>(
      toUnitPriceRowDto({
        id: updated.id,
        name: updated.name,
        sku: updated.sku,
        priceCents: updated.priceCents,
        costCents: updated.costCents,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Verificación manual de permisos (015 AC3/AC4 — Route Handlers fuera del alcance de unit testing del proyecto)**

Con `npm run dev` arriba y sesión de un usuario **sin** `finance.read`:

```bash
curl -i http://localhost:3000/api/admin/finance/unit-price
```

Expected: `403`, cuerpo `{ "error": { "code": "FORBIDDEN", ... } }`.

Con un usuario con `finance.read` pero sin `finance.manage_costs`:

```bash
curl -i -X PATCH http://localhost:3000/api/admin/finance/unit-price/<uuid-de-un-producto> \
  -H "Content-Type: application/json" -d '{"costCents": 1000}'
```

Expected: `403`.

(Ambas pruebas requieren la sesión de Clerk real del navegador — cópiala como cookie del `curl`, o verifica directamente navegando/con la UI de la Task 12 una vez lista.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/finance/unit-price/"
git commit -m "feat(finance): add unit-price list and cost update route handlers"
```

---

### Task 9: Servicio cliente y hooks de TanStack Query

**Files:**
- Create: `src/modules/finance/services/unit-price.service.ts`
- Create: `src/modules/finance/hooks/use-unit-price.ts`

**Interfaces:**
- Consumes: `api` (`@/lib/axios`); `UnitPriceQuery`, `UpdateCostInput`, `unitPriceQuerySchema` (Task 7); `UnitPriceListResponse`, `UnitPriceRowDto` (Task 7).
- Produces: `fetchUnitPrices(query): Promise<UnitPriceListResponse>`, `updateUnitPriceCost(productId, input): Promise<UnitPriceRowDto>`; `useUnitPrices(query)`, `useUnitPriceFilters()`, `useUpdateUnitPriceCost()`, `unitPriceKeys`, `DEFAULT_UNIT_PRICE_QUERY`, tipo `UnitPriceFiltersState`.

- [ ] **Step 1: Servicio axios**

Crea `src/modules/finance/services/unit-price.service.ts`:

```ts
import { api } from "@/lib/axios";
import type { UnitPriceQuery, UpdateCostInput } from "@/modules/finance/schemas/unit-price.schema";
import type { UnitPriceListResponse, UnitPriceRowDto } from "@/modules/finance/types/finance";

export async function fetchUnitPrices(query: UnitPriceQuery): Promise<UnitPriceListResponse> {
  const { data } = await api.get<UnitPriceListResponse>("/admin/finance/unit-price", {
    params: query,
  });

  return data;
}

export async function updateUnitPriceCost(
  productId: string,
  input: UpdateCostInput,
): Promise<UnitPriceRowDto> {
  const { data } = await api.patch<UnitPriceRowDto>(
    `/admin/finance/unit-price/${productId}`,
    input,
  );

  return data;
}
```

- [ ] **Step 2: Hooks**

Crea `src/modules/finance/hooks/use-unit-price.ts`:

```ts
"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  unitPriceQuerySchema,
  type UnitPriceQuery,
  type UpdateCostInput,
} from "@/modules/finance/schemas/unit-price.schema";
import { fetchUnitPrices, updateUnitPriceCost } from "@/modules/finance/services/unit-price.service";

export const unitPriceKeys = {
  all: ["finance", "unit-price"] as const,
  list: (query: UnitPriceQuery) => [...unitPriceKeys.all, "list", query] as const,
};

export type UnitPriceFiltersState = Omit<UnitPriceQuery, "page" | "pageSize">;

export const DEFAULT_UNIT_PRICE_QUERY: UnitPriceQuery = { page: 1, pageSize: 20 };

export function useUnitPrices(query: UnitPriceQuery) {
  return useQuery({
    queryKey: unitPriceKeys.list(query),
    queryFn: () => fetchUnitPrices(query),
    // Mantiene la página anterior visible mientras llega la siguiente.
    placeholderData: keepPreviousData,
  });
}

/** Única traducción entre la URL y `unitPriceQuerySchema`, mismo patrón que inventario. */
export function useUnitPriceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo<UnitPriceQuery>(() => {
    const parsed = unitPriceQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    return parsed.success ? parsed.data : DEFAULT_UNIT_PRICE_QUERY;
  }, [searchParams]);

  const push = useCallback(
    (next: UnitPriceQuery) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") continue;
        params.set(key, String(value));
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (patch: Partial<UnitPriceFiltersState>) => push({ ...query, ...patch, page: 1 }),
    [push, query],
  );

  const setPage = useCallback((page: number) => push({ ...query, page }), [push, query]);

  return { query, setFilters, setPage };
}

export function useUpdateUnitPriceCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: UpdateCostInput }) =>
      updateUnitPriceCost(productId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: unitPriceKeys.all });
    },
  });
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/finance/services/unit-price.service.ts src/modules/finance/hooks/use-unit-price.ts
git commit -m "feat(finance): add unit-price axios service and TanStack Query hooks"
```

---

### Task 10: UI — tabla y búsqueda

**Files:**
- Create: `src/modules/finance/components/unit-price-filters.tsx`
- Create: `src/modules/finance/components/unit-price-table.tsx`

**Interfaces:**
- Consumes: `useDebounce` (`@/hooks/use-debounce`); `DataTable`, `createDataTableColumnHelper` (`@/components/shared/data-table`); `formatPriceFromCents` (`@/lib/utils`); `UnitPriceRowDto`, `UnitPriceFiltersState` (Tasks 7/9).
- Produces: `UnitPriceFilters`, `UnitPriceTable` (componentes React).

- [ ] **Step 1: Filtro de búsqueda**

Crea `src/modules/finance/components/unit-price-filters.tsx` (calco de `inventory-filters.tsx` sin el `Select` de alerta, que no aplica aquí):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import type { UnitPriceFiltersState } from "@/modules/finance/hooks/use-unit-price";

type UnitPriceFiltersProps = {
  filters: UnitPriceFiltersState;
  onChange: (patch: Partial<UnitPriceFiltersState>) => void;
};

const SEARCH_DELAY_MS = 300;

export function UnitPriceFilters({ filters, onChange }: UnitPriceFiltersProps) {
  const applied = filters.q ?? "";

  const [term, setTerm] = useState(applied);
  const debouncedTerm = useDebounce(term, SEARCH_DELAY_MS);
  const lastPushed = useRef(applied);

  useEffect(() => {
    if (debouncedTerm === lastPushed.current) return;

    lastPushed.current = debouncedTerm;
    onChange({ q: debouncedTerm || undefined });
  }, [debouncedTerm, onChange]);

  useEffect(() => {
    if (applied === lastPushed.current) return;

    lastPushed.current = applied;
    setTerm(applied);
  }, [applied]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="unit-price-search">Buscar</Label>
      <Input
        id="unit-price-search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Nombre o SKU…"
        className="w-64"
      />
    </div>
  );
}
```

- [ ] **Step 2: Tabla**

Crea `src/modules/finance/components/unit-price-table.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { PencilIcon } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { formatPriceFromCents } from "@/lib/utils";
import type { UnitPriceRowDto } from "@/modules/finance/types/finance";

type UnitPriceTableProps = {
  rows: UnitPriceRowDto[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onEditCost: (row: UnitPriceRowDto) => void;
  /** Sin `finance.manage_costs` la tabla se ve completa, pero sin acción de editar. */
  canManageCosts: boolean;
};

const helper = createDataTableColumnHelper<UnitPriceRowDto>();

/** "Sin dato" en vez de 0%/NaN cuando el producto todavía no tiene costo (015 D5). */
function marginLabel(marginCents: number | null, marginPercent: number | null): string {
  if (marginCents === null || marginPercent === null) return "Sin dato";
  return `${formatPriceFromCents(marginCents)} (${marginPercent}%)`;
}

export function UnitPriceTable({
  rows,
  isLoading,
  errorMessage,
  page,
  pageSize,
  total,
  onPageChange,
  onEditCost,
  canManageCosts,
}: UnitPriceTableProps) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Producto",
          cell: (context) => {
            const row = context.row.original;

            return (
              <div className="flex flex-col">
                <span className="text-sm font-medium">{row.name}</span>
                <span className="text-muted-foreground font-mono text-xs">{row.sku ?? "—"}</span>
              </div>
            );
          },
        }),
        helper.accessor("priceCents", {
          header: "Precio",
          cell: (context) => (
            <span className="tabular-nums">{formatPriceFromCents(context.getValue())}</span>
          ),
        }),
        helper.accessor("costCents", {
          header: "Costo",
          cell: (context) => {
            const value = context.getValue();
            return (
              <span className="text-muted-foreground tabular-nums">
                {value === null ? "Sin dato" : formatPriceFromCents(value)}
              </span>
            );
          },
        }),
        helper.display({
          id: "margin",
          header: "Margen",
          cell: (context) => {
            const row = context.row.original;
            return <span className="tabular-nums">{marginLabel(row.marginCents, row.marginPercent)}</span>;
          },
        }),
        helper.display({
          id: "actions",
          header: "Acciones",
          cell: (context) => {
            const row = context.row.original;

            if (!canManageCosts) return null;

            return (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditCost(row)}
                  aria-label={`Editar el costo de ${row.name}`}
                >
                  <PencilIcon className="size-4" />
                  Editar costo
                </Button>
              </div>
            );
          },
        }),
      ]),
    [canManageCosts, onEditCost],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyMessage="No hay productos que coincidan con la búsqueda."
      pagination={{ page, pageSize, total, onPageChange }}
    />
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/finance/components/unit-price-filters.tsx src/modules/finance/components/unit-price-table.tsx
git commit -m "feat(finance): add unit-price search filter and table"
```

---

### Task 11: UI — diálogo de edición de costo

**Files:**
- Create: `src/modules/finance/components/edit-cost-dialog.tsx`

**Interfaces:**
- Consumes: `useUpdateUnitPriceCost` (Task 9); `costFormSchema`, `toUpdateCostInput` (Task 7); `UnitPriceRowDto` (Task 7); `formatPriceFromCents` (`@/lib/utils`).
- Produces: `EditCostDialog` (componente React).

- [ ] **Step 1: Crear el diálogo**

Crea `src/modules/finance/components/edit-cost-dialog.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatPriceFromCents } from "@/lib/utils";
import { useUpdateUnitPriceCost } from "@/modules/finance/hooks/use-unit-price";
import {
  costFormSchema,
  toUpdateCostInput,
  type CostFormValues,
} from "@/modules/finance/schemas/unit-price.schema";
import type { UnitPriceRowDto } from "@/modules/finance/types/finance";

type EditCostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: UnitPriceRowDto | null;
};

function emptyValues(costCents: number | null): CostFormValues {
  return { cost: costCents === null ? "" : (costCents / 100).toFixed(2) };
}

export function EditCostDialog({ open, onOpenChange, product }: EditCostDialogProps) {
  const updateCost = useUpdateUnitPriceCost();

  const form = useForm<CostFormValues>({
    resolver: zodResolver(costFormSchema),
    defaultValues: emptyValues(null),
  });

  const { formState, handleSubmit, register, reset } = form;
  const resetMutation = updateCost.reset;

  useEffect(() => {
    if (!open || !product) return;

    resetMutation();
    reset(emptyValues(product.costCents));
  }, [open, product, reset, resetMutation]);

  if (!product) return null;

  function onSubmit(values: CostFormValues) {
    const target = product;
    if (!target) return;

    const input = toUpdateCostInput(values);

    updateCost.mutate(
      { productId: target.productId, input },
      {
        onSuccess: () => {
          toast.success(`Costo de «${target.name}» actualizado.`);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar costo de «{product.name}»</DialogTitle>
          <DialogDescription>
            Precio de venta: {formatPriceFromCents(product.priceCents)}. Deja el campo vacío
            para borrar el costo cargado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="unit-cost">Costo unitario</FieldLabel>
            <Input id="unit-cost" inputMode="decimal" placeholder="0.00" {...register("cost")} />
            <FieldDescription>Mismo formato que el precio: hasta dos decimales.</FieldDescription>
            <FieldError errors={[formState.errors.cost]} />
          </Field>

          {updateCost.error ? (
            <p role="alert" className="text-destructive text-sm">
              {updateCost.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateCost.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateCost.isPending}>
              {updateCost.isPending ? "Guardando…" : "Guardar costo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/components/edit-cost-dialog.tsx
git commit -m "feat(finance): add edit cost dialog"
```

---

### Task 12: UI — manager, página y navegación

**Files:**
- Create: `src/modules/finance/components/unit-price-manager.tsx`
- Create: `src/app/(admin)/admin/finance/unit-price/page.tsx`
- Modify: `src/components/shared/admin-shell.tsx`

**Interfaces:**
- Consumes: `UnitPriceFilters`, `UnitPriceTable` (Task 10), `EditCostDialog` (Task 11), `useUnitPrices`, `useUnitPriceFilters` (Task 9); `can`, `PERMISSIONS` (`@/lib/permissions`).
- Produces: `UnitPriceManager` (componente React); página `/admin/finance/unit-price`; entrada "Finanzas" en el nav del admin.

- [ ] **Step 1: Manager**

Crea `src/modules/finance/components/unit-price-manager.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";

import { EditCostDialog } from "@/modules/finance/components/edit-cost-dialog";
import { UnitPriceFilters } from "@/modules/finance/components/unit-price-filters";
import { UnitPriceTable } from "@/modules/finance/components/unit-price-table";
import { useUnitPriceFilters, useUnitPrices } from "@/modules/finance/hooks/use-unit-price";
import type { UnitPriceRowDto } from "@/modules/finance/types/finance";

type UnitPriceManagerProps = {
  /** Lo resuelve la página en servidor con `can('finance.manage_costs')`. */
  canManageCosts: boolean;
};

export function UnitPriceManager({ canManageCosts }: UnitPriceManagerProps) {
  const { query, setFilters, setPage } = useUnitPriceFilters();
  const unitPrices = useUnitPrices(query);

  const [editing, setEditing] = useState<UnitPriceRowDto | null>(null);

  const onEditCost = useCallback((row: UnitPriceRowDto) => setEditing(row), []);

  return (
    <div className="flex flex-col gap-5">
      <UnitPriceFilters filters={query} onChange={setFilters} />

      <UnitPriceTable
        rows={unitPrices.data?.data ?? []}
        isLoading={unitPrices.isLoading}
        errorMessage={unitPrices.error?.message ?? null}
        page={query.page}
        pageSize={query.pageSize}
        total={unitPrices.data?.meta.total ?? 0}
        onPageChange={setPage}
        onEditCost={onEditCost}
        canManageCosts={canManageCosts}
      />

      <EditCostDialog
        open={editing !== null}
        onOpenChange={(open) => setEditing(open ? editing : null)}
        product={editing}
      />
    </div>
  );
}
```

- [ ] **Step 2: Página**

Crea `src/app/(admin)/admin/finance/unit-price/page.tsx` (calco de `src/app/(admin)/admin/inventory/page.tsx`; el gating es a nivel de página — D15/`admin-shell.tsx` documenta que el nav es solo chrome, la autorización vive en cada layout/página, igual que inventario, roles y bitácora):

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { can, PERMISSIONS } from "@/lib/permissions";
import { UnitPriceManager } from "@/modules/finance/components/unit-price-manager";

export const metadata: Metadata = {
  title: "Precio unitario",
};

export default async function AdminUnitPricePage() {
  // El listado ya exige `finance.read` en el handler; el guard de página evita
  // enseñar un panel que solo respondería 403.
  const [canRead, canManageCosts] = await Promise.all([
    can(PERMISSIONS.FINANCE_READ),
    can(PERMISSIONS.FINANCE_MANAGE_COSTS),
  ]);

  if (!canRead) redirect("/admin");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Precio unitario</h1>
        <p className="text-muted-foreground text-sm">
          Costo y margen de cada producto del catálogo. El costo es confidencial: solo lo ve
          quien tiene acceso financiero.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <UnitPriceManager canManageCosts={canManageCosts} />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 3: Entrada de navegación**

En `src/components/shared/admin-shell.tsx`, agrega la entrada "Finanzas" a `NAV_ITEMS` después de "Inventario" (mismo criterio sin gating que el resto de la lista: la nav es chrome, la página decide quién entra):

```ts
const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/categories", label: "Categorías" },
  { href: "/admin/products", label: "Productos" },
  { href: "/admin/inventory", label: "Inventario" },
  { href: "/admin/finance/unit-price", label: "Finanzas" },
  { href: "/admin/orders", label: "Pedidos" },
  { href: "/admin/roles", label: "Roles y accesos" },
  { href: "/admin/audit-logs", label: "Bitácora" },
];
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 5: Verificación manual en el navegador**

Run: `npm run dev`

Con un usuario `super_admin` o `admin`:
1. Entra a `/admin/finance/unit-price`. Debe verse la tabla con los productos del seed, todos con "Sin dato" en Costo y Margen.
2. Click "Editar costo" en un producto, escribe `50.00`, guarda. La fila debe actualizarse a Costo `50.00` y un margen calculado (no "Sin dato").
3. Repite dejando el campo vacío: el costo vuelve a "Sin dato".

Con un usuario `employee` (sin `finance.read` ni `finance.manage_costs`, 015 D4): navegar a `/admin/finance/unit-price` debe redirigir a `/admin`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/components/unit-price-manager.tsx "src/app/(admin)/admin/finance/" src/components/shared/admin-shell.tsx
git commit -m "feat(finance): add unit-price manager, page and nav entry"
```

---

### Task 13: Verificación final y cierre del spec

**Files:**
- Modify: `docs/specs/015-finance-unit-price-margin.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: spec 015 con `status: done` y criterios de aceptación marcados.

- [ ] **Step 1: Correr toda la verificación**

Run: `npm run typecheck && npm run lint && npm run build && npm test`
Expected: las cuatro en verde. `npm test` debe mostrar los tests nuevos de `finance.math.test.ts` y `unit-price.schema.test.ts` pasando.

- [ ] **Step 2: Repasar los criterios de aceptación del spec contra lo implementado**

Confirma uno por uno contra el código (no hace falta volver a levantar el servidor si la Task 12 ya los probó a mano):
- AC1–AC2: cubiertos por `finance.math.test.ts` (Task 3).
- AC3–AC5: cubiertos por Task 8 (verificación manual) y Task 5 (transacción + `logAudit`).
- AC6–AC7: cubiertos por Task 6 (verificación manual).
- AC8: corregido en la Task 12 — el nav no oculta la entrada (mismo criterio D15 que el resto del panel), pero la página `/admin/finance/unit-price` redirige a `/admin` sin `finance.read`. Ver nota de cierre del Step 3.

- [ ] **Step 3: Marcar el spec como cerrado**

En `docs/specs/015-finance-unit-price-margin.md`:
1. Cambia el frontmatter `status: draft` a `status: done`.
2. Marca los 8 checkboxes de "Criterios de aceptación" como `[x]`.
3. Corrige AC8 (encontrado durante el plan): cambia su texto de "no ve la entrada 'Finanzas' en el nav" a "no puede acceder a `/admin/finance/unit-price` (la página redirige a `/admin`); el nav no oculta la entrada, igual que el resto de secciones del panel (`admin-shell.tsx` D15)".
4. Agrega una sección `## Notas de implementación` al final, breve, con: el patrón calcado (`src/modules/inventory/`), y que `super_admin`/`admin` reciben los permisos nuevos automáticamente vía `ALL_PERMISSIONS` sin tocar `roles/constants.ts`.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/015-finance-unit-price-margin.md
git commit -m "docs(finance): close spec 015 — unit price and margin phase 1"
```

---

## Self-Review

**1. Cobertura del spec:** Objetivo → Tasks 8/12 (listado + edición visibles en `/admin/finance/unit-price`). Alcance (incluye) → columnas (Task 1), permisos (Task 2), página (Task 12), endpoints (Task 8). D1 (nullable sin default) → Task 1. D2 (snapshot en checkout) → Task 6. D3 (página propia, no en `product-form-dialog`) → Tasks 10–12 no tocan ese archivo. D4 (permisos por rol) → Task 2. D5 ("sin dato") → Tasks 3 y 10. D6 (auditoría, sin tabla de historial) → Task 5. Alcance (no incluye) → ningún task crea reporte histórico, tabla de historial de costos, ni edita `product-form-dialog.tsx`: confirmado por omisión.

**2. Placeholders:** ninguno — cada step tiene código completo o un comando con su output esperado.

**3. Consistencia de tipos:** `UnitPriceRow` (Task 4) se usa igual en Task 7 (`toUnitPriceRowDto`) y Task 8 (import type-only). `UnitPriceRowDto`/`UnitPriceListResponse` (Task 7) se usan igual en Tasks 8, 9, 10, 11, 12. `UpdateCostInput`/`CostFormValues`/`toUpdateCostInput` (Task 7) se usan igual en Tasks 9 y 11. `computeMargin` (Task 3) solo se llama desde Task 7. `updateProductCost` (Task 5) solo se llama desde Task 8. Nombres de permisos (`FINANCE_READ`, `FINANCE_MANAGE_COSTS`, Task 2) idénticos en Tasks 8 y 12.

**4. Review Focus:** los cinco puntos listados arriba están pinneados cada uno a un task concreto (3, 3, 7, 8+12, 6); ninguno quedó sin dueño.
