export interface ApiResult<T = void> {
  isSucceed: boolean;
  message: string;
  statusCode: number;
  data?: T;
}

export interface PaginationResult<T> {
  totalItems: number;
  totalPages: number;
  indexPage: number;
  pageSize: number;
  isSucceed: boolean;
  message: string;
  statusCode: number;
  data: T[];
}

export interface PaginationParams {
  page?: number;
  /** @deprecated Dùng `page` để khớp với PaginationQuery của backend */
  indexPage?: number;
  pageSize?: number;
  keyword?: string;
  sortField?: string;
  isAscending?: boolean;
}
