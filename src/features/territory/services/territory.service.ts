import { apiFetch, buildQueryString } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/lib/constants";
import type { ApiResult, PaginationParams, PaginationResult } from "@/types/api";
import type {
  AdministrativeDivisionQueryParams,
  AdministrativeDivisionResponse,
  AreaQueryParams,
  AreaResponse,
  BranchResponse,
  RestaurantTableQueryParams,
  RestaurantTableResponse,
} from "../types";

function toPaginationQuery(params?: PaginationParams) {
  return {
    page: params?.page ?? params?.indexPage,
    pageSize: params?.pageSize,
    keyword: params?.keyword,
    sortField: params?.sortField,
    isAscending: params?.isAscending,
  };
}

export async function getBranches(
  params?: PaginationParams
): Promise<PaginationResult<BranchResponse>> {
  const query = buildQueryString(toPaginationQuery(params));
  return apiFetch<PaginationResult<BranchResponse>>(
    `${API_ENDPOINTS.territory.branches}${query}`,
    { skipAuth: true }
  );
}

export async function getBranchById(
  branchId: string
): Promise<ApiResult<BranchResponse>> {
  return apiFetch<ApiResult<BranchResponse>>(
    API_ENDPOINTS.territory.branchById(branchId),
    { skipAuth: true }
  );
}

export async function getAdministrativeDivisions(
  params?: AdministrativeDivisionQueryParams
): Promise<PaginationResult<AdministrativeDivisionResponse>> {
  const query = buildQueryString({
    ...toPaginationQuery(params),
    level: params?.level,
    parentId: params?.parentId,
  });
  return apiFetch<PaginationResult<AdministrativeDivisionResponse>>(
    `${API_ENDPOINTS.territory.administrativeDivisions}${query}`,
    { skipAuth: true }
  );
}

export async function getAreas(
  params?: AreaQueryParams
): Promise<PaginationResult<AreaResponse>> {
  const query = buildQueryString({
    ...toPaginationQuery(params),
    branchId: params?.branchId,
    code: params?.code,
  });
  return apiFetch<PaginationResult<AreaResponse>>(
    `${API_ENDPOINTS.territory.areas}${query}`,
    { skipAuth: true }
  );
}

export async function getRestaurantTables(
  params?: RestaurantTableQueryParams
): Promise<PaginationResult<RestaurantTableResponse>> {
  const query = buildQueryString({
    ...toPaginationQuery(params),
    branchId: params?.branchId,
    areaId: params?.areaId,
  });
  return apiFetch<PaginationResult<RestaurantTableResponse>>(
    `${API_ENDPOINTS.territory.restaurantTables}${query}`,
    { skipAuth: true }
  );
}
