/**
 * Umbral de la alerta de inventario (013 D7). Vive aquí y no en el service para
 * que la card lo muestre en su rótulo sin duplicar el número; el umbral
 * configurable por producto es de un spec futuro de Inventario.
 */
export const LOW_STOCK_THRESHOLD = 5;

/** Tope del listado de stock bajo: es una alerta, no un inventario completo. */
export const LOW_STOCK_LIMIT = 10;

export const TOP_PRODUCTS_LIMIT = 5;
