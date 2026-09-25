"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ADMIN_ROOT = "/admin";

export function AdminNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  // La raíz del panel es prefijo de todo: solo cuenta por igualdad exacta.
  const active =
    href === ADMIN_ROOT
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "hover:bg-muted rounded-md px-3 py-2 text-sm transition-colors",
        active && "bg-muted text-foreground font-medium",
      )}
    >
      {label}
    </Link>
  );
}
