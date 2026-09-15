import type { ReactNode } from "react";

import { AdminShell } from "@/components/shared/admin-shell";

/**
 * Sin `requireAdmin()` a propósito: mismo patrón que el layout hermano de
 * categorías (003 D5). El layout es por sección y no se hoista a
 * `(admin-public)/admin/` para que la exención siga siendo opt-in: una página
 * futura del grupo no queda pública por herencia.
 */
export default function AdminPublicProductsLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
