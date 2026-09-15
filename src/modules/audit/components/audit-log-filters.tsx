"use client";

import { CalendarIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuditLogFiltersState } from "@/modules/audit/hooks/use-audit-logs";
import { AUDIT_SEVERITIES } from "@/server/db/schema/audit-log";

type AuditLogFiltersProps = {
  filters: AuditLogFiltersState;
  onChange: (patch: Partial<AuditLogFiltersState>) => void;
  onReset: () => void;
};

const ANY_SEVERITY = "__any__";

function formatRange(from?: string, to?: string): string {
  if (!from && !to) return "Cualquier fecha";

  const start = from ? new Date(from).toLocaleDateString("es") : "…";
  const end = to ? new Date(to).toLocaleDateString("es") : "…";

  return `${start} – ${end}`;
}

export function AuditLogFilters({ filters, onChange, onReset }: AuditLogFiltersProps) {
  const range = {
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="audit-entity-type">Entidad</Label>
        <Input
          id="audit-entity-type"
          value={filters.entityType ?? ""}
          onChange={(event) => onChange({ entityType: event.target.value })}
          placeholder="role, user…"
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="audit-entity-id">ID de entidad</Label>
        <Input
          id="audit-entity-id"
          value={filters.entityId ?? ""}
          onChange={(event) => onChange({ entityId: event.target.value })}
          placeholder="uuid"
          className="w-44"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="audit-action">Acción</Label>
        <Input
          id="audit-action"
          value={filters.action ?? ""}
          onChange={(event) => onChange({ action: event.target.value })}
          placeholder="role.created"
          className="w-48"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="audit-actor">Actor</Label>
        <Input
          id="audit-actor"
          value={filters.actorId ?? ""}
          onChange={(event) => onChange({ actorId: event.target.value })}
          placeholder="uuid del usuario"
          className="w-44"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Severidad</Label>
        <Select
          value={filters.severity ?? ANY_SEVERITY}
          onValueChange={(value) =>
            onChange({
              severity:
                value === ANY_SEVERITY
                  ? undefined
                  : (value as AuditLogFiltersState["severity"]),
            })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_SEVERITY}>Cualquiera</SelectItem>
            {AUDIT_SEVERITIES.map((severity) => (
              <SelectItem key={severity} value={severity}>
                {severity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Rango de fechas</Label>
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className="w-56 justify-start font-normal">
                <CalendarIcon className="size-4" />
                {formatRange(filters.from, filters.to)}
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="range"
              selected={range.from || range.to ? range : undefined}
              onSelect={(selected) =>
                onChange({
                  from: selected?.from?.toISOString(),
                  to: selected?.to?.toISOString(),
                })
              }
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button variant="ghost" onClick={onReset}>
        <XIcon className="size-4" />
        Limpiar
      </Button>
    </div>
  );
}
