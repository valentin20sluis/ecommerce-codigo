"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { productKeys } from "@/modules/products/hooks/use-products";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/modules/products/schemas/product.schema";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/modules/products/services/product.service";

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      updateProduct(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}
