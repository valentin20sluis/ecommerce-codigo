import { api } from "@/lib/axios";
import type {
  DeletePaymentMethodResponse,
  PaymentMethodListResponse,
  SetupSessionResponse,
} from "@/modules/payment-methods/types";

export async function createCardSetupSession(): Promise<SetupSessionResponse> {
  // Body vacío explícito: el endpoint no acepta ningún dato del cliente.
  const { data } = await api.post<SetupSessionResponse>("/payment-methods/setup-session", {});
  return data;
}

export async function fetchMyPaymentMethods(): Promise<PaymentMethodListResponse> {
  const { data } = await api.get<PaymentMethodListResponse>("/payment-methods");
  return data;
}

export async function deletePaymentMethod(id: string): Promise<DeletePaymentMethodResponse> {
  const { data } = await api.delete<DeletePaymentMethodResponse>(`/payment-methods/${id}`);
  return data;
}
