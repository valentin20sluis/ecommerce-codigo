import { api } from "@/lib/axios";
import type { OrdersQuery } from "@/modules/orders/schemas/order.schema";
import type { OrderListResponse, OrderReceiptResponse } from "@/modules/orders/types";

export async function fetchMyOrders(query: OrdersQuery): Promise<OrderListResponse> {
  const { data } = await api.get<OrderListResponse>("/orders", { params: query });
  return data;
}

export async function fetchOrderReceipt(orderId: string): Promise<OrderReceiptResponse> {
  const { data } = await api.get<OrderReceiptResponse>(`/orders/${orderId}/receipt`);
  return data;
}
