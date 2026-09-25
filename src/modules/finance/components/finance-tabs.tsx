"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FINANCE_SECTIONS } from "@/modules/finance/sections";

/** Pestañas de ruta (D6): el contenido es la página hija, por eso no hay `TabsContent`. */
export function FinanceTabs() {
  const pathname = usePathname();
  const active = FINANCE_SECTIONS.find(
    (section) => pathname === section.href || pathname.startsWith(`${section.href}/`),
  );

  return (
    <Tabs value={active?.slug ?? null}>
      <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b">
        {FINANCE_SECTIONS.map((section) =>
          section.status === "available" ? (
            <TabsTrigger
              key={section.slug}
              value={section.slug}
              nativeButton={false}
              render={<Link href={section.href} />}
              className="flex-none px-3"
            >
              {section.label}
            </TabsTrigger>
          ) : (
            <TabsTrigger key={section.slug} value={section.slug} disabled className="flex-none px-3">
              {section.label}
              <Badge variant="secondary">Próximamente</Badge>
            </TabsTrigger>
          ),
        )}
      </TabsList>
    </Tabs>
  );
}
