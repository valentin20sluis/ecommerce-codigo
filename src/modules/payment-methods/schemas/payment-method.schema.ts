import { z } from "zod";

/**
 * La sesión de setup no acepta ningún dato del cliente: el `userId` sale de
 * `requireAuth()` y el Customer de `users.stripe_customer_id`. `.strict()` deja
 * el contrato explícito y rechaza con 400 cualquier campo de más.
 */
export const createSetupSessionSchema = z.object({}).strict();

export type CreateSetupSessionInput = z.infer<typeof createSetupSessionSchema>;

export const paymentMethodIdParamSchema = z.object({ id: z.uuid() });

export type PaymentMethodIdParam = z.infer<typeof paymentMethodIdParamSchema>;
