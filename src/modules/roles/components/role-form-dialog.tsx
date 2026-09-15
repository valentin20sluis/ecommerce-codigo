"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRole, useUpdateRole } from "@/modules/roles/hooks/use-role-mutations";
import { createRoleSchema, type CreateRoleInput } from "@/modules/roles/schemas/role.schema";
import type { RoleListItem } from "@/modules/roles/types";

type RoleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleListItem | null;
};

const EMPTY_VALUES: CreateRoleInput = { slug: "", name: "", description: "" };

export function RoleFormDialog({ open, onOpenChange, role }: RoleFormDialogProps) {
  const isEditing = role !== null;
  const isSystemRole = role?.isSystem ?? false;
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const form = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: EMPTY_VALUES,
  });

  const { reset } = form;

  useEffect(() => {
    if (!open) return;

    reset(
      role
        ? { slug: role.slug, name: role.name, description: role.description ?? "" }
        : EMPTY_VALUES,
    );
  }, [open, role, reset]);

  const isPending = createRole.isPending || updateRole.isPending;
  const submitError = createRole.error ?? updateRole.error;

  async function onSubmit(values: CreateRoleInput) {
    const description = values.description?.trim() ? values.description.trim() : null;

    try {
      if (role) {
        await updateRole.mutateAsync({ id: role.id, input: { name: values.name, description } });
        toast.success("Rol actualizado.");
      } else {
        await createRole.mutateAsync({ ...values, description });
        toast.success("Rol creado.");
      }

      onOpenChange(false);
    } catch {
      // El detalle se muestra bajo el formulario; el estado vive en la mutación.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar rol" : "Nuevo rol"}</DialogTitle>
          <DialogDescription>
            {isSystemRole
              ? "Rol de sistema: el slug y el nombre son inmutables. Solo puedes ajustar la descripción."
              : isEditing
                ? "El slug es inmutable: otros registros lo referencian."
                : "El slug identifica al rol en el código y no se podrá cambiar después."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="role-slug">Slug</FieldLabel>
            <Input
              id="role-slug"
              placeholder="content_editor"
              disabled={isEditing}
              {...form.register("slug")}
            />
            <FieldError errors={[form.formState.errors.slug]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="role-name">Nombre</FieldLabel>
            <Input
              id="role-name"
              placeholder="Editor de contenido"
              disabled={isSystemRole}
              {...form.register("name")}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="role-description">Descripción</FieldLabel>
            <Textarea
              id="role-description"
              rows={3}
              placeholder="Qué puede hacer este rol."
              {...form.register("description")}
            />
            <FieldError errors={[form.formState.errors.description]} />
          </Field>

          {submitError ? (
            <p role="alert" className="text-destructive text-sm">
              {submitError.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
