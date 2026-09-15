"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import {
  useCreateCategory,
  useUpdateCategory,
} from "@/modules/categories/hooks/use-category-mutations";
import {
  createCategorySchema,
  type CategoryFormValues,
  type CreateCategoryInput,
} from "@/modules/categories/schemas/category.schema";
import type { CategoryDto } from "@/modules/categories/types";

type CategoryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryDto | null;
};

const EMPTY_VALUES: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  isActive: true,
};

export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const isEditing = category !== null;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const form = useForm<CategoryFormValues, unknown, CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: EMPTY_VALUES,
  });

  const { control, formState, handleSubmit, register, reset, setValue } = form;

  useEffect(() => {
    if (!open) return;

    reset(
      category
        ? {
            name: category.name,
            slug: category.slug,
            description: category.description ?? "",
            isActive: category.isActive,
          }
        : EMPTY_VALUES,
    );
  }, [open, category, reset]);

  const name = useWatch({ control, name: "name" });
  const isSlugDirty = formState.dirtyFields.slug === true;

  // Sugerencia solo en alta y mientras el admin no haya escrito su propio slug (D5).
  useEffect(() => {
    if (isEditing || isSlugDirty) return;

    setValue("slug", slugify(name));
  }, [name, isEditing, isSlugDirty, setValue]);

  const isPending = createCategory.isPending || updateCategory.isPending;
  const submitError = createCategory.error ?? updateCategory.error;

  async function onSubmit(values: CreateCategoryInput) {
    const input = {
      ...values,
      description: values.description?.trim() ? values.description.trim() : null,
    };

    try {
      if (category) {
        await updateCategory.mutateAsync({ id: category.id, input });
        toast.success("Categoría actualizada.");
      } else {
        await createCategory.mutateAsync(input);
        toast.success("Categoría creada.");
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
          <DialogTitle>{isEditing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cambiar el slug rompe los enlaces que ya apunten a esta categoría."
              : "El slug se sugiere desde el nombre y puedes ajustarlo antes de guardar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="category-name">Nombre</FieldLabel>
            <Input id="category-name" placeholder="Monitores" {...register("name")} />
            <FieldError errors={[formState.errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="category-slug">Slug</FieldLabel>
            <Input id="category-slug" placeholder="monitores" {...register("slug")} />
            <FieldError errors={[formState.errors.slug]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="category-description">Descripción</FieldLabel>
            <Textarea
              id="category-description"
              rows={3}
              placeholder="Qué agrupa esta categoría."
              {...register("description")}
            />
            <FieldError errors={[formState.errors.description]} />
          </Field>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Checkbox
                  id="category-is-active"
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="category-is-active">
              Activa: visible en el catálogo del storefront.
            </Label>
          </div>

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
