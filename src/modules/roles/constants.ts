import { DEFAULT_ROLE_SLUG, PERMISSIONS, type PermissionCode } from "@/lib/permissions.catalog";

export type SystemRoleDefinition = {
  slug: string;
  name: string;
  description: string;
  permissions: readonly PermissionCode[];
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Gobierno de la matriz de permisos: solo `super_admin` lo tiene. Es la única
 * diferencia entre `super_admin` y `admin`; ningún código compara slugs de rol.
 */
const ROLE_GOVERNANCE_PERMISSIONS: readonly PermissionCode[] = [
  PERMISSIONS.ROLES_CREATE,
  PERMISSIONS.ROLES_UPDATE,
  PERMISSIONS.ROLES_DELETE,
  PERMISSIONS.ROLES_MANAGE_PERMISSIONS,
];

const CATALOG_PERMISSIONS: readonly PermissionCode[] = [
  PERMISSIONS.CATEGORIES_READ,
  PERMISSIONS.CATEGORIES_CREATE,
  PERMISSIONS.CATEGORIES_UPDATE,
  PERMISSIONS.CATEGORIES_DELETE,
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.PRODUCTS_CREATE,
  PERMISSIONS.PRODUCTS_UPDATE,
  PERMISSIONS.PRODUCTS_DELETE,
];

/**
 * Roles semilla (`is_system = true`). No se borran ni se renombran desde la UI
 * (docs/SETUP.md §5.1 regla 2).
 */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    slug: "super_admin",
    name: "Super administrador",
    description: "Control total, incluida la matriz de permisos y el ciclo de vida de los roles.",
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: "admin",
    name: "Administrador",
    description: "Opera todo el panel y gestiona usuarios, sin alterar la definición de los roles.",
    permissions: ALL_PERMISSIONS.filter(
      (code) => !ROLE_GOVERNANCE_PERMISSIONS.includes(code),
    ),
  },
  {
    slug: "manager",
    name: "Gerente",
    description: "Gestiona catálogo y consulta accesos y bitácora, sin tocar la matriz de permisos.",
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.DASHBOARD_READ,
      ...CATALOG_PERMISSIONS,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.AUDIT_READ,
    ],
  },
  {
    slug: "employee",
    name: "Empleado",
    description: "Mantiene el catálogo de productos; no elimina ni gestiona accesos.",
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.CATEGORIES_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
    ],
  },
  {
    slug: DEFAULT_ROLE_SLUG,
    name: "Cliente",
    description: "Comprador del storefront. Sin acceso al panel de administración.",
    permissions: [],
  },
  {
    slug: "audit",
    name: "Auditoría",
    description: "Acceso de solo lectura a todo el panel, incluida la bitácora.",
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.CATEGORIES_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.AUDIT_READ,
    ],
  },
];

/** Roles retirados del catálogo: `db:seed` los elimina si no tienen usuarios. */
export const RETIRED_ROLE_SLUGS: readonly string[] = ["support"];
