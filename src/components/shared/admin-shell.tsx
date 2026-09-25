import type { ReactNode } from "react";

import { AdminNavLink } from "@/components/shared/admin-nav-link";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/categories", label: "Categorías" },
  { href: "/admin/products", label: "Productos" },
  { href: "/admin/inventory", label: "Inventario" },
  { href: "/admin/finance", label: "Finanzas" },
  { href: "/admin/orders", label: "Pedidos" },
  { href: "/admin/roles", label: "Roles y accesos" },
  { href: "/admin/audit-logs", label: "Bitácora" },
];

/** Solo chrome del panel: quién puede entrar lo decide cada layout (D15). */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1">
      <aside className="bg-muted/30 hidden w-60 shrink-0 border-r p-4 md:block">
        <p className="text-muted-foreground mb-3 px-3 text-xs font-medium tracking-wide uppercase">
          Administración
        </p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <AdminNavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
