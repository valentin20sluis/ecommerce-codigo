"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/profile", label: "Mi perfil" },
  { href: "/profile/favoritos", label: "Mis favoritos" },
  { href: "/profile/compras", label: "Mis compras" },
  { href: "/profile/tarjetas", label: "Mis tarjetas" },
] as const;

export function ProfileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-border pb-px">
      {SECTIONS.map((section) => {
        const active = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
