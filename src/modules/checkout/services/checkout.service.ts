import { api } from "@/lib/axios";
import type { CreateCheckoutSessionInput } from "@/modules/checkout/schemas/checkout.schema";
import type { CheckoutSessionResponse } from "@/modules/checkout/types";

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CheckoutSessionResponse> {
  const { data } = await api.post<CheckoutSessionResponse>("/checkout/session", input);
  return data;
}
