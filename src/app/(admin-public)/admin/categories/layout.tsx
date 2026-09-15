import type { ReactNode } from "react";

import { AdminShell } from "@/components/shared/admin-shell";

/**
 * Sin `requireAdmin()` a propósito: grupo hermano de `(admin)` para que
 * /admin/categories quede fuera del guard sin modificarlo (Enmienda 1, D14).
 * El grupo aloja además admin/products, con su propio layout: la exención es
 * opt-in por sección y no se hereda (003 D5).
 */
export default function AdminPublicCategoriesLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
