/**
 * Moneda única de la tienda (008 D1). ISO 4217 en minúsculas, como la espera
 * Stripe. La unidad menor del PEN son céntimos (2 decimales), idéntico al
 * `priceCents` entero del catálogo: `unit_amount` se pasa sin conversión.
 */
export const CHECKOUT_CURRENCY = "pen";

/**
 * Etiqueta de `integration_identifier` de Checkout, requerida desde la versión
 * de API `2026-03-25.dahlia`. El sufijo de 8 letras es parte del formato que
 * pide Stripe para agrupar y comparar flujos de checkout en el Dashboard; es
 * fijo a propósito para que todas las sesiones de esta integración caigan bajo
 * la misma etiqueta.
 */
export const CHECKOUT_INTEGRATION_IDENTIFIER = "ecommerce-tech-checkout-vhqzknrt";
