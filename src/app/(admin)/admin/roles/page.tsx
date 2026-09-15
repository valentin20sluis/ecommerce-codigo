import type { Metadata } from "next";

import { AccessWorkspace } from "@/modules/roles/components/access-workspace";

export const metadata: Metadata = {
  title: "Roles y accesos",
};

export default function AdminRolesPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Roles y accesos</h1>
        <p className="text-muted-foreground text-sm">
          Compón roles a partir de permisos atómicos y asígnalos a los usuarios sincronizados
          desde Clerk.
        </p>
      </header>

      <AccessWorkspace />
    </main>
  );
}
