import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/lib/constants";
import type { PaginationParams, PaginationResult } from "@/types/api";
import type { ProductResponse } from "../types";

export async function getProducts(
  params?: PaginationParams
): Promise<PaginationResult<ProductResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.indexPage !== undefined) {
    searchParams.set("indexPage", String(params.indexPage));
  }
  if (params?.pageSize !== undefined) {
    searchParams.set("pageSize", String(params.pageSize));
  }

  const query = searchParams.toString();
  const path = query
    ? `${API_ENDPOINTS.catalog.products}?${query}`
    : API_ENDPOINTS.catalog.products;

  return apiFetch<PaginationResult<ProductResponse>>(path);
}

