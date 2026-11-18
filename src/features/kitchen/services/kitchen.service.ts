import { apiFetch, buildQueryString, ApiError } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/lib/constants";
import type { ApiResult, PaginationResult } from "@/types/api";
import type {
  KitchenQueueQueryParams,
  OrderDetailResponse,
  OrderPreparationStatusResponse,
  OrderResponse,
  OrdersQueryParams,
  PreparationStatus,
} from "../types";
import { getEffectivePrepStatus } from "../utils/kitchen-helpers";

export async function getKitchenQueue(
  params?: KitchenQueueQueryParams
): Promise<PaginationResult<OrderDetailResponse>> {
  const query = buildQueryString({
    branchId: params?.branchId,
    restaurantTableId: params?.restaurantTableId,
    type: params?.type,
    paymentStatus: params?.paymentStatus,
    statuses: params?.statuses,
    from: params?.from,
    to: params?.to,
    page: params?.page ?? params?.indexPage ?? 1,
    pageSize: params?.pageSize ?? 100,
    keyword: params?.keyword,
    sortField: params?.sortField ?? "created_at",
    isAscending: params?.isAscending ?? true,
  });

  try {
    const res = await apiFetch<PaginationResult<OrderDetailResponse>>(
      `${API_ENDPOINTS.commerce.kitchenQueue}${query}`
    );

    const items = res.data ?? [];
    const hydrated = await Promise.all(
      items.map(async (order) => {
        if (Array.isArray(order.orderItems)) {
          return order;
        }
        try {
          const detailRes = await getOrderById(order.id);
          return detailRes.data ?? { ...order, orderItems: [] };
        } catch {
          return { ...order, orderItems: [] };
        }
      })
    );

    return {
      ...res,
      data: hydrated,
    };
  } catch (error) {
    // Fallback to GET /api/commerce/orders + GET /api/commerce/orders/{id} if kitchen-queue is unavailable
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 403)
    ) {
      return fetchOrdersWithDetailsFallback(params);
    }
    throw error;
  }
}

async function fetchOrdersWithDetailsFallback(
  params?: KitchenQueueQueryParams
): Promise<PaginationResult<OrderDetailResponse>> {
  const targetStatuses = params?.statuses?.length
    ? params.statuses
    : (["Confirmed", "Preparing"] as const);

  const responses = await Promise.all(
    targetStatuses.map((status) =>
      getOrders({
        branchId: params?.branchId,
        restaurantTableId: params?.restaurantTableId,
        type: params?.type,
        paymentStatus: params?.paymentStatus,
        status,
        from: params?.from,
        to: params?.to,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 50,
        keyword: params?.keyword,
        sortField: params?.sortField ?? "created_at",
        isAscending: params?.isAscending ?? true,
      })
    )
  );

  const mergedMap = new Map<string, OrderResponse>();
  for (const res of responses) {
    for (const order of res.data ?? []) {
      mergedMap.set(order.id, order);
    }
  }

  const orders = Array.from(mergedMap.values());
  const detailedOrders = await Promise.all(
    orders.map(async (order) => {
      try {
        const detail = await getOrderById(order.id);
        return detail.data ?? { ...order, orderItems: [] };
      } catch {
        return { ...order, orderItems: [] };
      }
    })
  );

  return {
    isSucceed: true,
    message: "OK",
    statusCode: 200,
    totalItems: detailedOrders.length,
    totalPages: 1,
    indexPage: 1,
    pageSize: detailedOrders.length || 1,
    data: detailedOrders,
  };
}

export async function getOrders(
  params?: OrdersQueryParams
): Promise<PaginationResult<OrderResponse>> {
  const query = buildQueryString({
    branchId: params?.branchId,
    customerId: params?.customerId,
    employeeId: params?.employeeId,
    restaurantTableId: params?.restaurantTableId,
    status: params?.status,
    type: params?.type,
    paymentStatus: params?.paymentStatus,
    paymentTiming: params?.paymentTiming,
    from: params?.from,
    to: params?.to,
    page: params?.page ?? params?.indexPage ?? 1,
    pageSize: params?.pageSize ?? 50,
    keyword: params?.keyword,
    sortField: params?.sortField ?? "created_at",
    isAscending: params?.isAscending ?? false,
  });

  return apiFetch<PaginationResult<OrderResponse>>(
    `${API_ENDPOINTS.commerce.orders}${query}`
  );
}

export async function getOrderById(
  id: string
): Promise<ApiResult<OrderDetailResponse>> {
  return apiFetch<ApiResult<OrderDetailResponse>>(
    API_ENDPOINTS.commerce.orderById(id)
  );
}

export async function confirmOrder(
  id: string
): Promise<ApiResult<OrderDetailResponse>> {
  return apiFetch<ApiResult<OrderDetailResponse>>(
    API_ENDPOINTS.commerce.confirmOrder(id),
    {
      method: "POST",
    }
  );
}

export async function startPreparingOrder(
  id: string
): Promise<ApiResult<OrderDetailResponse>> {
  return apiFetch<ApiResult<OrderDetailResponse>>(
    API_ENDPOINTS.commerce.prepareOrder(id),
    {
      method: "POST",
    }
  );
}

export async function markOrderReady(
  id: string
): Promise<ApiResult<OrderDetailResponse>> {
  return apiFetch<ApiResult<OrderDetailResponse>>(
    API_ENDPOINTS.commerce.readyOrder(id),
    {
      method: "POST",
    }
  );
}

export async function cancelOrder(
  id: string,
  reason?: string
): Promise<ApiResult<OrderDetailResponse>> {
  return apiFetch<ApiResult<OrderDetailResponse>>(
    API_ENDPOINTS.commerce.cancelOrder(id),
    {
      method: "POST",
      body: JSON.stringify({
        reason: reason?.trim() ? reason.trim() : undefined,
      }),
    }
  );
}

export async function advanceOrderItem(
  orderItemId: string
): Promise<ApiResult<OrderPreparationStatusResponse>> {
  return apiFetch<ApiResult<OrderPreparationStatusResponse>>(
    API_ENDPOINTS.commerce.advanceOrderItem(orderItemId),
    {
      method: "POST",
    }
  );
}

export async function revertOrderItem(
  orderItemId: string
): Promise<ApiResult<OrderPreparationStatusResponse>> {
  return apiFetch<ApiResult<OrderPreparationStatusResponse>>(
    API_ENDPOINTS.commerce.revertOrderItem(orderItemId),
    {
      method: "POST",
    }
  );
}

export async function updateOrderItemStatus(
  orderItemId: string,
  status: PreparationStatus
): Promise<ApiResult<OrderPreparationStatusResponse>> {
  return apiFetch<ApiResult<OrderPreparationStatusResponse>>(
    API_ENDPOINTS.commerce.updateOrderItemStatus(orderItemId),
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
}

/**
 * Hoàn tác (Recall) đơn hàng vừa báo xong (`Served` / `ReadyForPickup` / `ReadyForDelivery`)
 * quay lại trạng thái `Preparing` trong bếp bằng cách gọi API `revert` trên một món `Ready`
 * (hoặc cập nhật trạng thái món về `Preparing`).
 */
export async function recallOrderToKitchen(
  order: OrderDetailResponse
): Promise<ApiResult<OrderPreparationStatusResponse>> {
  let items = order.orderItems;
  if (!items || items.length === 0) {
    const detail = await getOrderById(order.id);
    items = detail.data?.orderItems ?? [];
  }

  const readyItem =
    items.find(
      (item) => getEffectivePrepStatus(item, order.status) === "Ready"
    ) ??
    items.find(
      (item) => getEffectivePrepStatus(item, order.status) !== "Cancelled"
    );

  if (!readyItem) {
    throw new ApiError(
      "Đơn hàng không có món hợp lệ để hoàn tác (Recall) về bếp.",
      400
    );
  }

  if (readyItem.preparationStatus === "Ready") {
    return revertOrderItem(readyItem.id);
  }

  return updateOrderItemStatus(readyItem.id, "Preparing");
}

