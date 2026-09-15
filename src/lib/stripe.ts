import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Instancia única del SDK, nunca el patrón global (`Stripe.apiKey = ...`), que
 * está deprecado. La clave vive solo en el servidor: este módulo no debe
 * importarse jamás desde un componente cliente.
 *
 * La construcción es perezosa y memoizada a propósito: `new Stripe()` lanza sin
 * clave, y `next build` evalúa este módulo al recolectar datos de las páginas.
 * Instanciar al importar tumbaría el build en cualquier entorno sin secreto.
 *
 * `apiVersion` se pinea a la versión que trae el SDK instalado (22.x) para que
 * un `npm update` no cambie el contrato de la API en silencio.
 */
export function getStripe(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY no está configurada.");
    }
    client = new Stripe(secretKey, { apiVersion: "2026-08-26.dahlia" });
  }

  return client;
}
