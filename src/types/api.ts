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
  indexPage?: number;
  pageSize?: number;
}

