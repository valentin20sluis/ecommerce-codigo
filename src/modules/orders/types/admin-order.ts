import type { Order } from "@/server/db/schema";
import type { AdminOrderCustomer, AdminOrderRow } from "@/server/repositories/order.repository";
import type { Paginated, Serialized } from "@/types/api";

export type AdminOrderDto = Serialized<Order>;

/** El listado del panel llega con el comprador ya resuelto por el join (012). */
export type AdminOrderListItem = AdminOrderDto & { customer: AdminOrderCustomer };

export type AdminOrderListResponse = Paginated<AdminOrderListItem>;

export function toAdminOrderDto(order: Order): AdminOrderDto {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function toAdminOrderListItem(row: AdminOrderRow): AdminOrderListItem {
  return { ...toAdminOrderDto(row), customer: row.customer };
}
