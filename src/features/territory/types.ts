import type { PaginationParams } from "@/types/api";

export interface BranchResponse {
  id: string;
  code: string;
  provinceName: string;
  wardName: string;
  streetAddress: string;
  fullAddress: string;
  latitude: string;
  longitude: string;
  status: string;
  openTime: string;
  closeTime: string;
}

export interface AreaResponse {
  id: string;
  branchCode?: string | null;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  status: string;
  tableCount: number;
}

export interface RestaurantTableResponse {
  id: string;
  areaName?: string | null;
  tableNumber: string;
  capacity: number;
  shape: string;
  status: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
}

export interface AreaQueryParams extends PaginationParams {
  branchId?: string;
  code?: string;
}

export interface RestaurantTableQueryParams extends PaginationParams {
  branchId?: string;
  areaId?: string;
}

export interface TableLookupEntry {
  id: string;
  tableNumber: string;
  areaName?: string | null;
  status: string;
}
