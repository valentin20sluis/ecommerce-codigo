import { api } from "@/lib/axios";
import type {
  AdminOrdersQuery,
  UpdateOrderStatusInput,
} from "@/modules/orders/schemas/admin-order.schema";
import type { AdminOrderDto, AdminOrderListResponse } from "@/modules/orders/types/admin-order";

export async function fetchAdminOrders(query: AdminOrdersQuery): Promise<AdminOrderListResponse> {
  const { data } = await api.get<AdminOrderListResponse>("/admin/orders", { params: query });
  return data;
}

export async function updateOrderStatus(
  id: string,
  input: UpdateOrderStatusInput,
): Promise<AdminOrderDto> {
  const { data } = await api.patch<AdminOrderDto>(`/admin/orders/${id}`, input);
  return data;
}
