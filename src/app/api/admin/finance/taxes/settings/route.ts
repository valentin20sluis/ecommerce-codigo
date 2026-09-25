import { NextResponse, type NextRequest } from "next/server";

import { BadRequestError, toErrorResponse } from "@/lib/api-error";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import {
  updateTaxSettingsSchema,
  type UpdateTaxSettingsInput,
} from "@/modules/finance/schemas/taxes.schema";
import { updateIncomeTaxRate } from "@/server/services/tax.service";

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requirePermission(PERMISSIONS.FINANCE_MANAGE_TAXES);

    // Un body que no es JSON es un error del cliente (018 AC8: 400, nunca 500).
    const body: unknown = await request.json().catch(() => {
      throw new BadRequestError("El cuerpo de la petición no es JSON válido.");
    });
    const input = updateTaxSettingsSchema.parse(body);

    const incomeTaxRateBps = await updateIncomeTaxRate(actor, input.incomeTaxRateBps);

    return NextResponse.json<UpdateTaxSettingsInput>({ incomeTaxRateBps });
  } catch (error) {
    return toErrorResponse(error);
  }
}
