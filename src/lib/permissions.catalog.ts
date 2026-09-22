/**
 * Catálogo puro de permisos: sin acceso a datos ni a Clerk, para que lo puedan
 * importar tanto el runtime de Next como los scripts (`db:seed`).
 * `src/lib/permissions.ts` lo reexporta y le añade la resolución en servidor.
 */
export const PERMISSIONS = {
  ADMIN_ACCESS: "admin.access",
  DASHBOARD_READ: "dashboard.read",
  CATEGORIES_READ: "categories.read",
  CATEGORIES_CREATE: "categories.create",
  CATEGORIES_UPDATE: "categories.update",
  CATEGORIES_DELETE: "categories.delete",
  PRODUCTS_READ: "products.read",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_DELETE: "products.delete",
  ORDERS_READ: "orders.read",
  ORDERS_UPDATE_STATUS: "orders.update_status",
  INVENTORY_READ: "inventory.read",
  INVENTORY_ADJUST: "inventory.adjust",
  FINANCE_READ: "finance.read",
  FINANCE_MANAGE_COSTS: "finance.manage_costs",
  ROLES_READ: "roles.read",
  ROLES_CREATE: "roles.create",
  ROLES_UPDATE: "roles.update",
  ROLES_DELETE: "roles.delete",
  ROLES_MANAGE_PERMISSIONS: "roles.manage_permissions",
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_ASSIGN_ROLES: "users.assign_roles",
  AUDIT_READ: "audit.read",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Un usuario sin filas en `user_roles` resuelve los permisos de este rol. */
export const DEFAULT_ROLE_SLUG = "customer";

const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  [PERMISSIONS.ADMIN_ACCESS]: "Entrar al panel de administración.",
  [PERMISSIONS.DASHBOARD_READ]: "Ver el dashboard y sus métricas.",
  [PERMISSIONS.CATEGORIES_READ]: "Ver el listado de categorías.",
  [PERMISSIONS.CATEGORIES_CREATE]: "Crear categorías.",
  [PERMISSIONS.CATEGORIES_UPDATE]: "Editar categorías.",
  [PERMISSIONS.CATEGORIES_DELETE]: "Eliminar categorías.",
  [PERMISSIONS.PRODUCTS_READ]: "Ver el listado de productos.",
  [PERMISSIONS.PRODUCTS_CREATE]: "Crear productos.",
  [PERMISSIONS.PRODUCTS_UPDATE]: "Editar productos.",
  [PERMISSIONS.PRODUCTS_DELETE]: "Eliminar productos.",
  [PERMISSIONS.ORDERS_READ]: "Ver el listado de pedidos.",
  [PERMISSIONS.ORDERS_UPDATE_STATUS]:
    "Avanzar el estado de fulfillment de un pedido y cancelarlo reponiendo stock.",
  [PERMISSIONS.INVENTORY_READ]: "Ver el inventario y el kardex de cada producto.",
  [PERMISSIONS.INVENTORY_ADJUST]: "Registrar ajustes, mermas y reposiciones de stock.",
  [PERMISSIONS.FINANCE_READ]: "Ver costo, margen y reportes financieros.",
  [PERMISSIONS.FINANCE_MANAGE_COSTS]: "Editar el costo unitario de un producto.",
  [PERMISSIONS.ROLES_READ]: "Ver roles y sus permisos.",
  [PERMISSIONS.ROLES_CREATE]: "Crear roles.",
  [PERMISSIONS.ROLES_UPDATE]: "Editar el nombre y la descripción de un rol.",
  [PERMISSIONS.ROLES_DELETE]: "Eliminar roles no de sistema.",
  [PERMISSIONS.ROLES_MANAGE_PERMISSIONS]: "Modificar la matriz de permisos de un rol.",
  [PERMISSIONS.USERS_READ]: "Ver el listado de usuarios.",
  [PERMISSIONS.USERS_CREATE]: "Dar de alta usuarios.",
  [PERMISSIONS.USERS_UPDATE]: "Editar los datos de un usuario.",
  [PERMISSIONS.USERS_ASSIGN_ROLES]: "Asignar roles a un usuario.",
  [PERMISSIONS.AUDIT_READ]: "Consultar la bitácora de auditoría.",
};

export type PermissionDefinition = {
  code: PermissionCode;
  resource: string;
  action: string;
  description: string;
};

function parseCode(code: PermissionCode): { resource: string; action: string } {
  const separator = code.indexOf(".");
  return { resource: code.slice(0, separator), action: code.slice(separator + 1) };
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = Object.values(
  PERMISSIONS,
).map((code) => ({ code, ...parseCode(code), description: PERMISSION_DESCRIPTIONS[code] }));

export type PermissionGroup<T> = {
  resource: string;
  permissions: T[];
};

export function groupByResource<T extends { resource: string }>(items: T[]): PermissionGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const bucket = groups.get(item.resource);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(item.resource, [item]);
    }
  }

  return [...groups.entries()]
    .map(([resource, permissions]) => ({ resource, permissions }))
    .sort((a, b) => a.resource.localeCompare(b.resource));
}
