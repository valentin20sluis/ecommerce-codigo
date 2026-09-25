import { logAudit } from "@/lib/audit";
import { toUtcDateString } from "@/modules/finance/recurring";
import { DEFAULT_INCOME_TAX_RATE_BPS } from "@/modules/finance/taxes";
import { buildTaxSummary, type TaxSummaryDto } from "@/modules/finance/types/taxes";
import { dbTx } from "@/server/db/pool";
import type { User } from "@/server/db/schema";
import * as expenseRepository from "@/server/repositories/expense.repository";
import * as financeSettingsRepository from "@/server/repositories/finance-settings.repository";
import * as orderRepository from "@/server/repositories/order.repository";
import { ensureRecurringExpenses } from "@/server/services/recurring-expense.service";

const ENTITY = "finance_settings";
const SETTINGS_ENTITY_ID = "1";

/** Sin fila en `finance_settings`, la tasa del régimen general (018 D8). */
export async function getIncomeTaxRateBps(): Promise<number> {
  const settings = await financeSettingsRepository.find();
  return settings?.incomeTaxRateBps ?? DEFAULT_INCOME_TAX_RATE_BPS;
}

/**
 * Resumen de Impuestos (018). Genera antes los egresos recurrentes vencidos
 * (D9, regla D12 de 017): sin eso, la utilidad omitiría las plantillas del mes.
 * El resto de lecturas va en paralelo y sin N+1.
 */
export async function getTaxSummary(from: Date, to: Date): Promise<TaxSummaryDto> {
  await ensureRecurringExpenses();

  const [monthlySales, byCategoryRows, expensesCents, incomeTaxRateBps] = await Promise.all([
    orderRepository.getMonthlySales(from, to),
    orderRepository.getRevenueByCategory(from, to),
    expenseRepository.sumAmountBetween(toUtcDateString(from), toUtcDateString(to)),
    getIncomeTaxRateBps(),
  ]);

  return buildTaxSummary({
    from,
    to,
    monthlySales,
    revenueCentsKnown: byCategoryRows.reduce((total, row) => total + row.revenueCentsKnown, 0),
    marginCentsKnown: byCategoryRows.reduce((total, row) => total + row.marginCentsKnown, 0),
    expensesCents,
    incomeTaxRateBps,
  });
}

/** Upsert de la fila única con su auditoría en la misma transacción (018 D8). */
export async function updateIncomeTaxRate(actor: User, incomeTaxRateBps: number): Promise<number> {
  return dbTx.transaction(async (tx) => {
    const current = await financeSettingsRepository.findForUpdate(tx);
    const before = current?.incomeTaxRateBps ?? DEFAULT_INCOME_TAX_RATE_BPS;

    const updated = await financeSettingsRepository.upsertIncomeTaxRate(
      tx,
      incomeTaxRateBps,
      actor.id,
    );

    await logAudit(tx, {
      actorId: actor.id,
      action: "finance_settings.updated",
      entityType: ENTITY,
      entityId: SETTINGS_ENTITY_ID,
      changes: {
        before: { incomeTaxRateBps: before },
        after: { incomeTaxRateBps: updated.incomeTaxRateBps },
      },
    });

    return updated.incomeTaxRateBps;
  });
}
