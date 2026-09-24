import { BadRequestError, NotFoundError } from "@/lib/api-error";
import { diffChanges, logAudit } from "@/lib/audit";
import {
  dueOccurrences,
  lastOccurrenceOnOrBefore,
  minStartsOn,
  toUtcDateString,
} from "@/modules/finance/recurring";
import type {
  CreateRecurringExpenseInput,
  UpdateRecurringExpenseInput,
} from "@/modules/finance/schemas/expense.schema";
import { dbTx, type ReadExecutor } from "@/server/db/pool";
import type { RecurringExpense, User } from "@/server/db/schema";
import * as expenseRepository from "@/server/repositories/expense.repository";
import * as recurringExpenseRepository from "@/server/repositories/recurring-expense.repository";

const ENTITY = "recurring_expense";

function auditableFields(template: RecurringExpense): Record<string, unknown> {
  return {
    category: template.category,
    description: template.description,
    amountCents: template.amountCents,
    dayOfMonth: template.dayOfMonth,
    startsOn: template.startsOn,
    endsOn: template.endsOn,
    isActive: template.isActive,
  };
}

async function requireTemplate(tx: ReadExecutor, id: string): Promise<RecurringExpense> {
  const template = await recurringExpenseRepository.findById(id, tx);
  if (!template) throw new NotFoundError("La plantilla no existe.");

  return template;
}

/**
 * Materializa los vencimientos pendientes de las plantillas activas (017 D5).
 * Idempotente y segura en concurrencia: bloquea las plantillas con `FOR UPDATE`
 * (las peticiones concurrentes esperan y releen la marca), inserta con `ON CONFLICT DO NOTHING` y avanza la marca
 * `generated_through` — por eso un egreso generado que se borra no reaparece
 * (D6). Es una acción del sistema: `actor_id` nulo y sin exigir
 * `finance.manage_expenses`, así que la puede disparar un lector con
 * `finance.read`. Todo lector de egresos debe llamarla antes de leer (D12).
 */
export async function ensureRecurringExpenses(
  today: string = toUtcDateString(new Date()),
): Promise<number> {
  return dbTx.transaction(async (tx) => {
    const templates = await recurringExpenseRepository.lockActive(tx);
    let generated = 0;

    for (const template of templates) {
      const dates = dueOccurrences(template, today);
      if (dates.length === 0) continue;

      const inserted = await expenseRepository.insertManyIgnoringConflicts(
        tx,
        dates.map((incurredOn) => ({
          category: template.category,
          description: template.description,
          amountCents: template.amountCents,
          incurredOn,
          recurringExpenseId: template.id,
          createdBy: null,
        })),
      );

      await recurringExpenseRepository.setGeneratedThrough(tx, template.id, dates[dates.length - 1]);

      await logAudit(tx, {
        actorId: null,
        action: "expense.recurring_generated",
        entityType: ENTITY,
        entityId: template.id,
        metadata: {
          source: "recurring_generation",
          recurringExpenseId: template.id,
          count: inserted,
        },
      });

      generated += inserted;
    }

    return generated;
  });
}

export async function createRecurringExpense(
  actor: User,
  input: CreateRecurringExpenseInput,
  today: string = toUtcDateString(new Date()),
): Promise<RecurringExpense> {
  const earliest = minStartsOn(today);
  if (input.startsOn < earliest) {
    throw new BadRequestError(`La fecha de inicio no puede ser anterior a ${earliest}.`);
  }

  return dbTx.transaction(async (tx) => {
    const template = await recurringExpenseRepository.create(tx, {
      category: input.category,
      description: input.description,
      amountCents: input.amountCents,
      dayOfMonth: input.dayOfMonth,
      startsOn: input.startsOn,
      endsOn: input.endsOn ?? null,
      generatedThrough: null,
      createdBy: actor.id,
    });

    await logAudit(tx, {
      actorId: actor.id,
      action: "recurring_expense.created",
      entityType: ENTITY,
      entityId: template.id,
      changes: { before: null, after: auditableFields(template) },
    });

    return template;
  });
}

export async function updateRecurringExpense(
  actor: User,
  id: string,
  input: UpdateRecurringExpenseInput,
  today: string = toUtcDateString(new Date()),
): Promise<RecurringExpense> {
  return dbTx.transaction(async (tx) => {
    const current = await requireTemplate(tx, id);

    const endsOn = input.endsOn === undefined ? current.endsOn : input.endsOn;
    if (endsOn !== null && endsOn < current.startsOn) {
      throw new BadRequestError("La fecha de fin no puede ser anterior a la de inicio.");
    }

    const dayOfMonth = input.dayOfMonth ?? current.dayOfMonth;

    // Reactivar no genera el período en pausa (017 D7): la marca salta al
    // último vencimiento ≤ hoy.
    let generatedThrough = current.generatedThrough;
    if (input.isActive === true && !current.isActive) {
      const caughtUp = lastOccurrenceOnOrBefore(
        { dayOfMonth, startsOn: current.startsOn, endsOn },
        today,
      );
      if (caughtUp !== null && (generatedThrough === null || caughtUp > generatedThrough)) {
        generatedThrough = caughtUp;
      }
    }

    const updated = await recurringExpenseRepository.update(tx, id, {
      category: input.category ?? current.category,
      description: input.description ?? current.description,
      amountCents: input.amountCents ?? current.amountCents,
      dayOfMonth,
      endsOn,
      isActive: input.isActive ?? current.isActive,
      generatedThrough,
    });

    if (!updated) throw new NotFoundError("La plantilla no existe.");

    const changes = diffChanges(auditableFields(current), auditableFields(updated));
    if (changes) {
      await logAudit(tx, {
        actorId: actor.id,
        action: "recurring_expense.updated",
        entityType: ENTITY,
        entityId: updated.id,
        changes,
      });
    }

    return updated;
  });
}

export async function deleteRecurringExpense(actor: User, id: string): Promise<void> {
  await dbTx.transaction(async (tx) => {
    const template = await requireTemplate(tx, id);

    await recurringExpenseRepository.remove(tx, id);

    await logAudit(tx, {
      actorId: actor.id,
      action: "recurring_expense.deleted",
      entityType: ENTITY,
      entityId: template.id,
      changes: { before: auditableFields(template), after: null },
      severity: "warning",
    });
  });
}

/** Genera antes de leer (017 D12): el listado muestra el próximo vencimiento ya al día. */
export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  await ensureRecurringExpenses();
  return recurringExpenseRepository.listAll();
}
