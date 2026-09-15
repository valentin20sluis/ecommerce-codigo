"use client";

import { useMutation } from "@tanstack/react-query";

import type { CreateCheckoutSessionInput } from "@/modules/checkout/schemas/checkout.schema";
import { createCheckoutSession } from "@/modules/checkout/services/checkout.service";

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (input: CreateCheckoutSessionInput) => createCheckoutSession(input),
    // Salida del origen: `router.push` no sirve para una URL de checkout.stripe.com.
    onSuccess: ({ url }) => window.location.assign(url),
  });
}
