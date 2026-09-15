import { z } from "zod";

/**
 * El precio **nunca** viaja en el body: el schema ni siquiera lo acepta. Se
 * relee de `products.priceCents` en el mismo request (008 AC4).
 */
export const createCheckoutSessionSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "El carrito está vacío.")
    .max(50, "El carrito supera el máximo de 50 líneas."),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;

export type CheckoutLineInput = CreateCheckoutSessionInput["items"][number];
