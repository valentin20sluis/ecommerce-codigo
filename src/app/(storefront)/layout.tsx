import type { ReactNode } from "react";

import { Header } from "@/components/shared/header";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
