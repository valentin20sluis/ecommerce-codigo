import { api } from "@/lib/axios";
import type {
  CreateProductInput,
  ProductsQuery,
  UpdateProductInput,
} from "@/modules/products/schemas/product.schema";
import type { ProductDto, ProductListResponse } from "@/modules/products/types";

export async function fetchProducts(query: ProductsQuery): Promise<ProductListResponse> {
  const { data } = await api.get<ProductListResponse>("/admin/products", { params: query });
  return data;
}

export async function fetchProduct(id: string): Promise<ProductDto> {
  const { data } = await api.get<ProductDto>(`/admin/products/${id}`);
  return data;
}

export async function createProduct(input: CreateProductInput): Promise<ProductDto> {
  const { data } = await api.post<ProductDto>("/admin/products", input);
  return data;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
  const { data } = await api.patch<ProductDto>(`/admin/products/${id}`, input);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/admin/products/${id}`);
}
