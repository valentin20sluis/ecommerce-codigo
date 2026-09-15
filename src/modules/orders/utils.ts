import type { OrderListItemDto } from "@/modules/orders/types";

export type OrderDayGroup = {
  /** `YYYY-MM-DD` local: identidad estable del grupo para el `key` de React. */
  dayKey: string;
  label: string;
  orders: OrderListItemDto[];
};

const dayLabelFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

/**
 * Clave por calendario del comprador (009 D3): `toISOString()` agruparía en UTC
 * y movería de día una compra nocturna.
 */
function toLocalDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** Conserva el orden de entrada, que ya viene `createdAt` desc del servidor. */
export function groupOrdersByDay(orders: OrderListItemDto[]): OrderDayGroup[] {
  const groups = new Map<string, OrderDayGroup>();

  for (const order of orders) {
    const date = new Date(order.createdAt);
    const dayKey = toLocalDayKey(date);
    const group = groups.get(dayKey);

    if (group) {
      group.orders.push(order);
      continue;
    }

    groups.set(dayKey, { dayKey, label: dayLabelFormatter.format(date), orders: [order] });
  }

  return [...groups.values()];
}

export function formatOrderTime(createdAt: string): string {
  return timeFormatter.format(new Date(createdAt));
}

export function countOrderUnits(order: OrderListItemDto): number {
  return order.items.reduce((total, item) => total + item.qty, 0);
}
