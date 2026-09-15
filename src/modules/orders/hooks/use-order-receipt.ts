"use client";

import { useQuery } from "@tanstack/react-query";

import { orderKeys } from "@/modules/orders/hooks/use-my-orders";
import { fetchOrderReceipt } from "@/modules/orders/services/order.service";

/**
 * `enabled` la ata a la apertura del Dialog: la boleta se resuelve on-demand
 * (009 D1), nunca al listar. Sin reintentos: un 409 ("aún no está disponible")
 * no se arregla repitiendo el request en el mismo segundo.
 */
export function useOrderReceipt(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: orderKeys.receipt(orderId),
    queryFn: () => fetchOrderReceipt(orderId),
    enabled,
    retry: false,
  });
}
