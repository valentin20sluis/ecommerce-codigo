import type { ReactNode } from "react";

import { ProfileNav } from "@/modules/customers/components/profile-nav";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
      <ProfileNav />
      {children}
    </main>
  );
}
