import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/lib/constants";
import type { PaginationParams, PaginationResult } from "@/types/api";
import type { BranchResponse } from "../types";

export async function getBranches(
  params?: PaginationParams
): Promise<PaginationResult<BranchResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.indexPage !== undefined) {
    searchParams.set("indexPage", String(params.indexPage));
  }
  if (params?.pageSize !== undefined) {
    searchParams.set("pageSize", String(params.pageSize));
  }

  const query = searchParams.toString();
  const path = query
    ? `${API_ENDPOINTS.territory.branches}?${query}`
    : API_ENDPOINTS.territory.branches;

  return apiFetch<PaginationResult<BranchResponse>>(path);
}

