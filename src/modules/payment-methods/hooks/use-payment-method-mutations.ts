"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { paymentMethodKeys } from "@/modules/payment-methods/hooks/use-my-payment-methods";
import {
  createCardSetupSession,
  deletePaymentMethod,
} from "@/modules/payment-methods/services/payment-method.service";

export function useCreateCardSetupSession() {
  return useMutation({
    mutationFn: createCardSetupSession,
    // Salida del origen: `router.push` no sirve para una URL de checkout.stripe.com.
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePaymentMethod(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all }),
  });
}
