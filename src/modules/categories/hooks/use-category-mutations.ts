"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { categoryKeys } from "@/modules/categories/hooks/use-categories";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/modules/categories/schemas/category.schema";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/modules/categories/services/category.service";

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => createCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      updateCategory(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}
