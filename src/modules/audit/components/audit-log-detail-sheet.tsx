"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AuditLogListItem } from "@/modules/audit/types";

type AuditLogDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AuditLogListItem | null;
};

function DefinitionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">{label}</dt>
      <dd className="font-mono text-sm break-all">{value}</dd>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium">{title}</h3>
      <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

export function AuditLogDetailSheet({ open, onOpenChange, log }: AuditLogDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-mono">{log?.action}</SheetTitle>
          <SheetDescription>
            {log ? new Date(log.createdAt).toLocaleString("es") : null}
          </SheetDescription>
        </SheetHeader>

        {log ? (
          <ScrollArea className="flex-1 px-4 pb-6">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{log.severity}</Badge>
                <Badge variant="secondary">{log.entityType}</Badge>
              </div>

              <dl className="grid grid-cols-2 gap-4">
                <DefinitionRow label="Evento" value={log.id} />
                <DefinitionRow label="Entidad" value={log.entityId ?? "—"} />
                <DefinitionRow label="Actor" value={log.actor?.email ?? "Sistema"} />
                <DefinitionRow label="IP" value={log.ipAddress ?? "—"} />
              </dl>

              {log.userAgent ? (
                <DefinitionRow label="User agent" value={log.userAgent} />
              ) : null}

              {log.changes ? (
                <>
                  <JsonBlock title="Antes" value={log.changes.before} />
                  <JsonBlock title="Después" value={log.changes.after} />
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Este evento no registró cambios de campos.
                </p>
              )}

              {log.metadata ? <JsonBlock title="Metadatos" value={log.metadata} /> : null}
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
