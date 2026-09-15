import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";

export const metadata: Metadata = {
  title: "Mi perfil | E-commerce Tech",
};

/** Datos de Clerk sin espejo local: no hay nada de `users`/`user_roles` que mostrar acá. */
export default async function ProfilePage() {
  const user = await currentUser();

  if (!user) {
    // El middleware ya exige sesión para /profile; esto es solo defensivo.
    return <p className="pt-4 text-sm text-muted-foreground">No se pudo cargar tu perfil.</p>;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Sin nombre";
  const primaryEmail =
    user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "Sin email";
  const memberSince = new Date(user.createdAt).toLocaleDateString("es", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="flex flex-col gap-6 pt-4">
      <div className="flex items-center gap-4">
        {user.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- avatar de Clerk, host externo no configurado en next.config.ts
          <img src={user.imageUrl} alt={fullName} className="size-16 rounded-full object-cover" />
        )}
        <div>
          <p className="text-lg font-semibold">{fullName}</p>
          <p className="text-sm text-muted-foreground">{primaryEmail}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-3xl border border-border bg-card p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Nombre</dt>
          <dd className="text-sm font-medium">{fullName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Usuario</dt>
          <dd className="text-sm font-medium">{user.username ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="text-sm font-medium">{primaryEmail}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Cliente desde</dt>
          <dd className="text-sm font-medium">{memberSince}</dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        Estos datos los administra tu cuenta de inicio de sesión. Para editarlos, abrí el menú de tu
        foto de perfil.
      </p>
    </section>
  );
}
