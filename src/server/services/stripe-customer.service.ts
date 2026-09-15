import { getStripe } from "@/lib/stripe";
import { dbTx } from "@/server/db/pool";
import type { User } from "@/server/db/schema";
import * as userRepository from "@/server/repositories/user.repository";

/**
 * Customer perezoso (010 D3): se crea en el primer `setup-session` del usuario y
 * se reusa después. 008 no lo necesita — paga con `customer_email` — así que no
 * hay un Customer por cada alta de Clerk ensuciando el Dashboard.
 *
 * La llamada a Stripe queda fuera de la transacción, mismo criterio que
 * `checkout.service.ts`: no se sostiene una conexión de Neon durante un HTTP
 * externo.
 */
export async function ensureStripeCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: user.email,
    // Ni nombre ni dirección: el enlace inverso alcanza para operar desde el
    // Dashboard y evita duplicar PII que ya vive en Clerk.
    metadata: { userId: user.id },
  });

  const updated = await dbTx.transaction((tx) =>
    userRepository.setStripeCustomerId(tx, user.id, customer.id),
  );

  // Otro request ganó la carrera y ya enlazó un Customer: gana el persistido y
  // el recién creado queda huérfano en Stripe, sin tarjetas ni cobros.
  if (!updated) {
    const current = await userRepository.findById(user.id);
    if (current?.stripeCustomerId) return current.stripeCustomerId;

    throw new Error("No se pudo enlazar el Customer de Stripe con el usuario.");
  }

  return customer.id;
}
