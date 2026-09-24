import { NotFoundError } from "@/lib/api-error";
import { diffChanges, logAudit } from "@/lib/audit";
import type {
  CreateExpenseInput,
  ExpenseCategoryValue,
  UpdateExpenseInput,
} from "@/modules/finance/schemas/expense.schema";
import { dbTx } from "@/server/db/pool";
import type { Expense, ExpenseCategory, User } from "@/server/db/schema";
import * as expenseRepository from "@/server/repositories/expense.repository";
import { ensureRecurringExpenses } from "@/server/services/recurring-expense.service";

const ENTITY = "expense";

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * La lista de categorías del schema Zod (cliente) y la del enum de Postgres
 * (servidor) están duplicadas a propósito. Esta constante falla en compilación
 * si divergen: sin ella, agregar una a un lado solo se notaría en producción.
 */
const categoriesInSync: Equals<ExpenseCategory, ExpenseCategoryValue> = true;
void categoriesInSync;

function auditableFields(expense: Expense): Record<string, unknown> {
  return {
    category: expense.category,
    description: expense.description,
    amountCents: expense.amountCents,
    incurredOn: expense.incurredOn,
    recurringExpenseId: expense.recurringExpenseId,
  };
}

export async function createExpense(actor: User, input: CreateExpenseInput): Promise<Expense> {
  return dbTx.transaction(async (tx) => {
    const expense = await expenseRepository.create(tx, {
      category: input.category,
      description: input.description,
      amountCents: input.amountCents,
      incurredOn: input.incurredOn,
      createdBy: actor.id,
    });

    await logAudit(tx, {
      actorId: actor.id,
      action: "expense.created",
      entityType: ENTITY,
      entityId: expense.id,
      changes: { before: null, after: auditableFields(expense) },
    });

    return expense;
  });
}

export async function updateExpense(
  actor: User,
  id: string,
  input: UpdateExpenseInput,
): Promise<Expense> {
  return dbTx.transaction(async (tx) => {
    const current = await expenseRepository.findById(id, tx);
    if (!current) throw new NotFoundError("El egreso no existe.");

    const updated = await expenseRepository.update(tx, id, input);
    if (!updated) throw new NotFoundError("El egreso no existe.");

    const changes = diffChanges(auditableFields(current), auditableFields(updated));
    if (changes) {
      await logAudit(tx, {
        actorId: actor.id,
        action: "expense.updated",
        entityType: ENTITY,
        entityId: updated.id,
        changes,
      });
    }

    return updated;
  });
}

/** Borrado físico (017 D3): la foto completa queda en `audit_logs.changes.before`. */
export async function deleteExpense(actor: User, id: string): Promise<void> {
  await dbTx.transaction(async (tx) => {
    const expense = await expenseRepository.findById(id, tx);
    if (!expense) throw new NotFoundError("El egreso no existe.");

    await expenseRepository.remove(tx, id);

    await logAudit(tx, {
      actorId: actor.id,
      action: "expense.deleted",
      entityType: ENTITY,
      entityId: expense.id,
      changes: { before: auditableFields(expense), after: null },
      severity: "warning",
    });
  });
}

/** Genera los vencimientos pendientes antes de leer (017 D5/D12). */
export async function listExpenses(
  params: expenseRepository.ListExpensesParams,
): Promise<{ data: Expense[]; total: number; totalCents: number }> {
  await ensureRecurringExpenses();
  return expenseRepository.listPaginated(params);
}
