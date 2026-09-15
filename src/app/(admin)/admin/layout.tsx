import { redirect } from "next/navigation";

import { AdminShell } from "@/components/shared/admin-shell";
import { ForbiddenError, UnauthorizedError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth";

type AccessOutcome = "granted" | "unauthenticated" | "forbidden";

async function resolveAccess(): Promise<AccessOutcome> {
  try {
    await requireAdmin();
    return "granted";
  } catch (error) {
    if (error instanceof UnauthorizedError) return "unauthenticated";
    if (error instanceof ForbiddenError) return "forbidden";
    throw error;
  }
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // redirect() lanza NEXT_REDIRECT: fuera del try para no capturarlo.
  const outcome = await resolveAccess();

  if (outcome === "unauthenticated") redirect("/sign-in");
  if (outcome === "forbidden") redirect("/");

  return <AdminShell>{children}</AdminShell>;
}
