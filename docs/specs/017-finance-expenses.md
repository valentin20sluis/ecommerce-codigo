---
id: 017
title: Finanzas — Fase 3: Egresos (gastos operativos + plantillas recurrentes)
status: done
module: finance
scope: admin
---

# 017 — Finanzas — Fase 3: Egresos

## Objetivo
Un operador con `finance.manage_expenses` registra los gastos operativos del negocio (publicidad,
sueldos, alquiler...) y define plantillas mensuales que generan sus egresos solas; cualquiera con
`finance.read` los consulta filtrados por fecha y categoría con su total. Es la fuente de datos de
egresos que consumirán Ganancias (fase 5) y Contabilidad (fase 6).

## Contexto — roadmap del módulo de Finanzas
Fase 3 de 6 (tabla completa en `docs/specs/015-finance-unit-price-margin.md`). Independiente de las
fases 1 y 2, pero se apoya en su módulo `src/modules/finance/` y en los aprendizajes de sus
revisiones finales (ver D9).

## Alcance
Incluye:
- Tablas `expenses` y `recurring_expenses` (una migración).
- CRUD de egresos y de plantillas recurrentes, con auditoría.
- Generación automática e idempotente de los egresos de las plantillas, al consultar.
- Página `/admin/finance/expenses` con dos pestañas: **Egresos** y **Recurrentes**.
- Permiso nuevo `finance.manage_expenses`.

No incluye:
- **Compra de mercadería**: su costo ya vive en `cost_cents_snapshot` (fase 1); registrarlo aquí
  se restaría dos veces en Ganancias.
- Comprobantes adjuntos, impuestos por egreso (fase 4), multimoneda, presupuestos, aprobaciones.
- Categorías editables por el usuario; frecuencias semanal o anual.
- Reportes agregados por categoría/mes (fase 5).

## Decisiones
| # | Decisión |
|---|---|
| D1 | Egresos = solo gastos operativos. La compra de mercadería queda fuera para no duplicar el costo por producto (015). |
| D2 | Categorías: enum de Postgres fijo `expense_category` = `advertising`, `payroll`, `rent`, `software`, `shipping`, `payment_fees`, `taxes_fees`, `other`. Las etiquetas en español viven en `modules/finance/constants.ts`. Sin CRUD de categorías: agregar una es un cambio de código + migración aditiva (`ALTER TYPE … ADD VALUE`). |
| D3 | Correcciones: editar y **borrar físicamente** (decisión del humano, contra la recomendación de anular). Mitigación: el `DELETE` escribe en `audit_logs` la foto completa del registro (`changes.before`), así el historial se reconstruye desde la bitácora. |
| D4 | Solo frecuencia **mensual**. `day_of_month` 1–31; en meses más cortos el vencimiento cae en el último día del mes. |
| D5 | Generación sin cron: `ensureRecurringExpenses(today)` se ejecuta al consultar (GET del listado) y crea, por plantilla activa, los vencimientos entre su marca `generated_through` y hoy (UTC). Es una acción del sistema (`actor_id` nulo, `metadata.source = 'recurring_generation'`), **no** exige `finance.manage_expenses`: un lector con `finance.read` puede dispararla. |
| D6 | La marca `generated_through` (fecha del último vencimiento materializado) es la fuente de verdad del avance, no la existencia de filas: un egreso generado que se borra **no reaparece**. El índice único parcial `(recurring_expense_id, incurred_on)` es solo el candado contra ejecuciones concurrentes (`INSERT … ON CONFLICT DO NOTHING`, plantillas bloqueadas con `FOR UPDATE`; enmendado tras la revisión final: con `SKIP LOCKED` un lector concurrente volvía antes de que se confirmara la generación). |
| D7 | Editar una plantilla (monto, descripción, categoría, `day_of_month`, `ends_on`, `is_active`) solo afecta vencimientos **futuros**; lo ya generado no se toca. `starts_on` no es editable (otra fecha de inicio = otra plantilla). Borrar una plantilla conserva sus egresos ya generados (`ON DELETE SET NULL`). Reactivar una plantilla pausada **no** genera retroactivo: avanza `generated_through` al último vencimiento ≤ hoy. |
| D8 | `starts_on` no puede ser anterior a hoy − 1826 días (~5 años, mismo tope de rango que ingresos): acota el relleno de meses atrasados a 60 filas por plantilla. El formulario avisa cuántos egresos pasados se generarán. |
| D9 | Lecciones de 015/016 aplicadas de origen: (a) tope máximo de monto `MAX_EXPENSE_CENTS = 99_999_999` en Zod (sin él, un monto > `int4` daba un 500); (b) tope de 1826 días al rango del listado; (c) fechas de negocio en UTC y `incurred_on` como tipo `date`; (d) los archivos que corren bajo `node --test` no importan **valores** vía alias `@/` (imports relativos con `.ts`, como `user-projection.ts`); (e) sin cast que desactive la sincronía de listas duplicadas a propósito. |
| D10 | Permisos: `finance.read` (existente) para ver; `finance.manage_expenses` (nuevo) para crear/editar/borrar egresos y plantillas. `super_admin`/`admin` lo reciben por `ALL_PERMISSIONS`; `manager` y `audit` solo `finance.read`; `employee` ninguno. |
| D11 | Una sola moneda: los montos se interpretan en `CHECKOUT_CURRENCY` (`pen`); no se guarda columna de moneda. Si un día hay multimoneda será una migración aditiva. |
| D12 | Todo lector de egresos debe llamar antes a `ensureRecurringExpenses`, o omitiría meses aún no materializados. Hoy solo el listado; **la fase 5 (Ganancias) queda obligada a hacerlo**. |

## Datos
Migración Drizzle (`npm run db:generate`), sin backfill.

`expenses` (`src/server/db/schema/expense.ts`):
- `id` uuid PK · `category` `expense_category` NOT NULL · `description` text NOT NULL
- `amount_cents` integer NOT NULL, `CHECK (amount_cents > 0)`
- `incurred_on` date NOT NULL
- `recurring_expense_id` uuid NULL → `recurring_expenses.id` `ON DELETE SET NULL`
- `created_by` uuid NULL → `users.id` `ON DELETE SET NULL` (nulo = generado por el sistema)
- `created_at`, `updated_at` timestamptz NOT NULL default now
- Índices: `(incurred_on desc)`, `(category, incurred_on desc)`; único parcial
  `(recurring_expense_id, incurred_on) WHERE recurring_expense_id IS NOT NULL`.

`recurring_expenses` (`src/server/db/schema/recurring-expense.ts`):
- `id` uuid PK · `category` · `description` · `amount_cents` (`CHECK > 0`)
- `day_of_month` integer NOT NULL, `CHECK (day_of_month BETWEEN 1 AND 31)`
- `starts_on` date NOT NULL · `ends_on` date NULL, `CHECK (ends_on IS NULL OR ends_on >= starts_on)`
- `is_active` boolean NOT NULL default true
- `generated_through` date NULL (nulo = aún no generó nada)
- `created_by` (igual que arriba), `created_at`, `updated_at`.

## API
| Método | Ruta | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/finance/expenses` | `finance.read` | `from`, `to` (fecha `YYYY-MM-DD` en UTC, `z.iso.date()`, requeridos, `to >= from`, ≤ 1826 días; el cliente convierte el rango del selector a fechas UTC antes de pedir), `category?`, `page`, `pageSize` | `{ data: ExpenseDto[], meta: { page, pageSize, total }, totalCents }` |
| POST | `/api/admin/finance/expenses` | `finance.manage_expenses` | `{ category, description, amountCents, incurredOn }` | `ExpenseDto` (201) |
| PATCH | `/api/admin/finance/expenses/[id]` | `finance.manage_expenses` | campos parciales de arriba | `ExpenseDto` |
| DELETE | `/api/admin/finance/expenses/[id]` | `finance.manage_expenses` | — | 204 |
| GET | `/api/admin/finance/recurring-expenses` | `finance.read` | — | `{ data: RecurringExpenseDto[] }` (incluye `nextDueOn` derivado) |
| POST | `/api/admin/finance/recurring-expenses` | `finance.manage_expenses` | `{ category, description, amountCents, dayOfMonth, startsOn, endsOn? }` | `RecurringExpenseDto` (201) |
| PATCH | `/api/admin/finance/recurring-expenses/[id]` | `finance.manage_expenses` | parcial, sin `startsOn` | `RecurringExpenseDto` |
| DELETE | `/api/admin/finance/recurring-expenses/[id]` | `finance.manage_expenses` | — | 204 |

`GET .../expenses` llama a `ensureRecurringExpenses(hoy UTC)` antes de leer (D5/D12). Todas las
rutas validan con Zod antes de tocar datos; `middleware.ts` ya cubre `/api/admin(.*)`.
`totalCents` es la suma del filtro completo (no de la página).

Auditoría (`logAudit`, misma transacción): `expense.created|updated|deleted`,
`recurring_expense.created|updated|deleted`, `expense.recurring_generated` (sistema, con
`metadata: { recurringExpenseId, count }`).

## UI
`src/app/(admin)/admin/finance/expenses/page.tsx`, con el guard de página de las fases previas
(`can(FINANCE_READ)`, redirect a `/admin`). Un `ExpensesManager` con `Tabs` (shadcn):
- **Egresos**: filtros (rango con el selector de Ingresos + categoría), tabla con paginación,
  total del filtro, diálogos de alta/edición y de confirmación de borrado (`alert-dialog`).
- **Recurrentes**: tabla de plantillas (monto, día, próximo vencimiento, estado) con diálogo de
  alta/edición y borrado; el alta muestra "se generarán N egresos pasados" si `startsOn` < hoy.
Las acciones de escritura se ocultan sin `finance.manage_expenses` (el handler lo exige igual).
Estados de carga, error con reintento y vacío en ambas pestañas. Nav "Egresos" en
`admin-shell.tsx`, sin gating (D15 de la fase 1).

## Reutilizar
- Patrón CRUD + auditoría: `src/server/services/product.service.ts` (`diffChanges`, transacción con `dbTx`, mapeo de violaciones únicas).
- Patrón de módulo cliente: `src/modules/inventory/` y `src/modules/finance/` (schemas, types, services, hooks, components).
- `RevenueRangePicker`, `resolveDateRangePreset`, `REVENUE_RANGE_PRESETS` (`modules/finance/`): selector de rango, sin cambios.
- `src/components/shared/data-table.tsx`; shadcn ya instalados: `tabs`, `select`, `textarea`, `field`, `alert-dialog`, `badge`, `dialog`, `calendar`, `popover` — ninguno nuevo.
- `src/lib/permissions.catalog.ts` + `src/modules/roles/constants.ts` (alta del permiso y asignación); `src/lib/audit.ts`; `src/server/db/pool.ts` (`dbTx`).
- `src/modules/finance/utils.ts`: funciones puras de fechas del reporte (UTC).

## Criterios de aceptación
- [ ] AC1 — Dado un alta válida, cuando se hace POST, entonces se crea el egreso y se escribe `expense.created` en `audit_logs` en la misma transacción. **No observado en ejecución** (revisión final 015 I3): implementado y tipado, pero ningún test ni script lo corrió; queda por construcción.
- [x] AC2 — Dado `amountCents` ≤ 0 o mayor que `MAX_EXPENSE_CENTS`, entonces responde 400 (nunca 500).
- [ ] AC3 — Dado un DELETE de egreso, entonces la fila desaparece y `audit_logs` guarda la foto completa previa. **No observado en ejecución** (revisión final 015 I3): implementado y tipado, pero ningún test ni script lo corrió; queda por construcción.
- [ ] AC4 — Dado un usuario con `finance.read` sin `finance.manage_expenses`, entonces POST/PATCH/DELETE responden 403 y la UI no muestra las acciones de escritura. **No observado con sesión real de navegador**: `requirePermission`/`can()` son las mismas funciones ya usadas por inventario e ingresos.
- [x] AC5 — Dado un GET con `to < from` o rango > 1826 días, entonces responde 400.
- [ ] AC6 — Dado un GET con filtros, entonces `totalCents` suma todos los egresos del filtro, no solo los de la página. **No observado en ejecución** (revisión final 015 I3): implementado y tipado, pero ningún test ni script lo corrió; queda por construcción.
- [x] AC7 — Dada una plantilla activa con `day_of_month = 31` y `starts_on` hace 3 meses, cuando se consulta el listado, entonces se generan exactamente los vencimientos ≤ hoy, y en febrero cae el día 28/29.
- [x] AC8 — Dada la generación ejecutada dos veces seguidas (o en paralelo), entonces no se duplica ningún vencimiento.
- [x] AC9 — Dado un egreso generado que se borra, cuando se vuelve a consultar, entonces no reaparece.
- [ ] AC10 — Dada una plantilla editada (nuevo monto), entonces los egresos ya generados conservan el monto original y los nuevos vencimientos usan el nuevo. **No observado en ejecución** (revisión final 015 I3): implementado y tipado, pero ningún test ni script lo corrió; queda por construcción.
- [x] AC11 — Dada una plantilla pausada y luego reactivada, entonces no se generan vencimientos del período en pausa.
- [ ] AC12 — Dado `starts_on` anterior a hoy − 1826 días, entonces la API responde 400. **No observado en ejecución** (revisión final 015 I3): implementado y tipado, pero ningún test ni script lo corrió; queda por construcción.
- [ ] AC13 — Dado un usuario sin `finance.read`, entonces la API responde 403 y `/admin/finance/expenses` redirige a `/admin`. **No observado con sesión real de navegador**, mismo motivo que AC4.

## Notas
- La generación en un GET tiene efecto secundario a propósito (D5): es idempotente, acotada (≤ 60 filas por plantilla) y evita infraestructura de cron que hoy no existe. Si algún día se despliega con cron, `ensureRecurringExpenses` se puede invocar también desde ahí sin cambios.
- `incurred_on` es `date`: los rangos del listado se comparan por día UTC, coherente con `getDailySales` (013/016).

## Notas de implementación (017, cierre)

- Calca los patrones de inventario (`stock-adjust-dialog`, filtros en URL), de ingresos
  (`RevenueRangePicker`, `resolveDateRangePreset`) y de productos (servicio con `diffChanges` y
  auditoría en la misma transacción). Sin componentes shadcn nuevos.
- **Fase 5 (Ganancias) queda obligada** a llamar a `ensureRecurringExpenses()` antes de leer
  egresos (D12): hoy lo hacen `listExpenses` y `listRecurringExpenses`; un lector que consulte
  `expenses` directo omitiría los meses aún no materializados.
- La generación se verificó **contra la BD real** con un script temporal (ya borrado): 3
  vencimientos generados para una plantilla de día 31 iniciada hace 3 meses, segunda ejecución
  sin duplicar, 3 ejecuciones **en paralelo** sin duplicar, un egreso borrado no reaparece, y
  reactivar una plantilla pausada no genera retroactivo (AC7, AC8, AC9, AC11).
- AC1, AC3, AC6, AC10 y AC12 (auditoría transaccional, `totalCents`, no tocar lo ya generado,
  tope de `starts_on`) están implementados y tipados pero **no se ejecutaron**; AC4 y AC13 requieren
  una sesión real de navegador. Verificación pendiente del usuario en `/admin/finance/expenses`:
  crear/editar/borrar un egreso, crear una plantilla con inicio pasado y ver el aviso de meses
  atrasados, y confirmar que un `manager` no ve las acciones de escritura.
- Migración `0011` aplicada a Neon junto con `db:seed` (27 permisos), con confirmación del usuario.

Verificación final: `npm run typecheck && npm run lint && npm run build && npm test` — 261/261.
