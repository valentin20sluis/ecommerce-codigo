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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slugify, toCents } from "@/lib/utils";
import { useCategories } from "@/modules/categories/hooks/use-categories";
import {
  useCreateProduct,
  useUpdateProduct,
} from "@/modules/products/hooks/use-product-mutations";
import {
  productFormSchema,
  type CreateProductInput,
  type ProductFormValues,
} from "@/modules/products/schemas/product.schema";
import type { ProductDto } from "@/modules/products/types";

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductDto | null;
};

const EMPTY_VALUES: ProductFormValues = {
  name: "",
  slug: "",
  sku: "",
  description: "",
  categoryId: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  isActive: true,
  imageUrl: "",
};

/** Inversa exacta de `toCents`: los centavos enteros vuelven a unidades sin arrastre binario. */
function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const isEditing = product !== null;
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const categories = useCategories({ status: "active", page: 1, pageSize: 100 });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  const { control, formState, handleSubmit, register, reset, setValue } = form;

  useEffect(() => {
    if (!open) return;

    reset(
      product
        ? {
            name: product.name,
            slug: product.slug,
            sku: product.sku ?? "",
            description: product.description ?? "",
            categoryId: product.categoryId,
            price: fromCents(product.priceCents),
            compareAtPrice:
              product.compareAtPriceCents != null ? fromCents(product.compareAtPriceCents) : "",
            stock: String(product.stock),
            isActive: product.isActive,
            imageUrl: product.imageUrl ?? "",
          }
        : EMPTY_VALUES,
    );
  }, [open, product, reset]);

  const name = useWatch({ control, name: "name" });
  const isSlugDirty = formState.dirtyFields.slug === true;

  // Sugerencia solo en alta y mientras el admin no haya escrito su propio slug.
  useEffect(() => {
    if (isEditing || isSlugDirty) return;

    setValue("slug", slugify(name));
  }, [name, isEditing, isSlugDirty, setValue]);

  const isPending = createProduct.isPending || updateProduct.isPending;
  const submitError = createProduct.error ?? updateProduct.error;

  async function onSubmit(values: ProductFormValues) {
    const sku = values.sku.trim();
    const description = values.description.trim();
    const imageUrl = values.imageUrl.trim();
    const compareAtPrice = values.compareAtPrice.trim();

    const input: CreateProductInput = {
      name: values.name,
      slug: values.slug,
      // `undefined`, nunca `""`: dos productos sin SKU chocarían contra el índice único (D2).
      sku: sku ? sku : undefined,
      description: description ? description : null,
      categoryId: values.categoryId,
      priceCents: toCents(values.price),
      compareAtPriceCents: compareAtPrice ? toCents(compareAtPrice) : null,
      stock: Number.parseInt(values.stock, 10),
      isActive: values.isActive,
      imageUrl: imageUrl ? imageUrl : null,
    };

    try {
      if (product) {
        await updateProduct.mutateAsync({ id: product.id, input });
        toast.success("Producto actualizado.");
      } else {
        await createProduct.mutateAsync(input);
        toast.success("Producto creado.");
      }

      onOpenChange(false);
    } catch {
      // El detalle se muestra bajo el formulario; el estado vive en la mutación.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cambiar el slug rompe los enlaces que ya apunten a este producto."
              : "El slug se sugiere desde el nombre y puedes ajustarlo antes de guardar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="product-name">Nombre</FieldLabel>
            <Input id="product-name" placeholder="Monitor 27&quot; 144 Hz" {...register("name")} />
            <FieldError errors={[formState.errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-slug">Slug</FieldLabel>
            <Input id="product-slug" placeholder="monitor-27-144hz" {...register("slug")} />
            <FieldError errors={[formState.errors.slug]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-sku">SKU (opcional)</FieldLabel>
            <Input id="product-sku" placeholder="MON-27-144" {...register("sku")} />
            <FieldError errors={[formState.errors.sku]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-category">Categoría</FieldLabel>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="product-category" className="w-full">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.data?.data ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[formState.errors.categoryId]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="product-price">Precio</FieldLabel>
              <Input
                id="product-price"
                inputMode="decimal"
                placeholder="1299.90"
                {...register("price")}
              />
              <FieldError errors={[formState.errors.price]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="product-compare-at-price">Precio anterior (opcional)</FieldLabel>
              <Input
                id="product-compare-at-price"
                inputMode="decimal"
                placeholder="1599.90"
                {...register("compareAtPrice")}
              />
              <FieldError errors={[formState.errors.compareAtPrice]} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="product-stock">Stock</FieldLabel>
            <Input id="product-stock" inputMode="numeric" placeholder="0" {...register("stock")} />
            <FieldError errors={[formState.errors.stock]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-image-url">URL de imagen (opcional)</FieldLabel>
            <Input
              id="product-image-url"
              placeholder="https://…/monitor.jpg"
              {...register("imageUrl")}
            />
            <FieldError errors={[formState.errors.imageUrl]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="product-description">Descripción</FieldLabel>
            <Textarea
              id="product-description"
              rows={3}
              placeholder="Qué incluye y para quién es este producto."
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
                  id="product-is-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="product-is-active">Activo: visible en el catálogo del storefront.</Label>
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
