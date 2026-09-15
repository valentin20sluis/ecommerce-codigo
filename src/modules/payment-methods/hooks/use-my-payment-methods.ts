"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMyPaymentMethods } from "@/modules/payment-methods/services/payment-method.service";

export const paymentMethodKeys = {
  all: ["payment-methods"] as const,
  list: () => [...paymentMethodKeys.all, "list"] as const,
};

export function useMyPaymentMethods() {
  return useQuery({
    queryKey: paymentMethodKeys.list(),
    queryFn: fetchMyPaymentMethods,
  });
}
