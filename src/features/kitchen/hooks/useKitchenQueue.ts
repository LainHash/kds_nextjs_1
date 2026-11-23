"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
import {
  subscribeBranchOrdersRealtime,
  type OrderRealtimeEvent,
  type RealtimeTransportState,
} from "@/lib/order-realtime";
import {
  advanceOrderItem,
  cancelOrder,
  getKitchenQueue,
  getOrderById,
  markOrderReady,
  recallOrderToKitchen,
  revertOrderItem,
  startPreparingOrder,
  updateOrderItemStatus,
} from "../services/kitchen.service";
import type {
  OrderDetailResponse,
  OrderPreparationStatusResponse,
  PreparationStatus,
} from "../types";
import {
  LIVE_BOARD_ORDER_STATUSES,
  playNewOrderChime,
} from "../utils/kitchen-helpers";

export type KdsConnectionState = "online" | "syncing" | "reconnecting";

export interface KdsActionFeedback {
  type: "success" | "error";
  message: string;
}

export interface UseKitchenQueueOptions {
  branchId: string | null | undefined;
  pollIntervalMs?: number;
  soundEnabled?: boolean;
  enabled?: boolean;
}

function getKitchenQueueQueryKey(branchId: string | null) {
  return ["kds", "kitchen-queue", branchId] as const;
}

export function useKitchenQueue({
  branchId,
  pollIntervalMs = 5000,
  soundEnabled = true,
  enabled = true,
}: UseKitchenQueueOptions) {
  const targetBranchId = branchId ?? null;
  const queryClient = useQueryClient();

  const [realtimeState, setRealtimeState] =
    useState<RealtimeTransportState>("connecting");
  const [feedback, setFeedback] = useState<KdsActionFeedback | null>(null);
  const [busyOrderIds, setBusyOrderIds] = useState<Record<string, boolean>>({});
  const [busyItemIds, setBusyItemIds] = useState<Record<string, boolean>>({});

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const loadedBranchRef = useRef<string | null>(null);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const showFeedback = useCallback(
    (type: "success" | "error", message: string) => {
      setFeedback({ type, message });
    },
    []
  );

  const dismissFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const queryKey = useMemo(
    () => getKitchenQueueQueryKey(targetBranchId),
    [targetBranchId]
  );

  const fetchQueue = useCallback(async (branchToLoad: string) => {
    const res = await getKitchenQueue({
      branchId: branchToLoad,
      statuses: LIVE_BOARD_ORDER_STATUSES,
      page: 1,
      pageSize: 100,
      sortField: "created_at",
      isAscending: true,
    });

    const nextOrders = res.data ?? [];

    if (loadedBranchRef.current === branchToLoad) {
      const hasNewConfirmedOrder = nextOrders.some(
        (o) => o.status === "Confirmed" && !knownOrderIdsRef.current.has(o.id)
      );
      if (hasNewConfirmedOrder && soundEnabledRef.current) {
        playNewOrderChime();
      }
    }

    knownOrderIdsRef.current = new Set(nextOrders.map((o) => o.id));
    loadedBranchRef.current = branchToLoad;
    return nextOrders;
  }, []);

  // When SignalR is connected, relax fallback polling to 30s; when disconnected, use pollIntervalMs
  const effectiveRefetchInterval = useMemo(() => {
    if (!targetBranchId || !enabled || pollIntervalMs <= 0) return false as const;
    return realtimeState === "connected"
      ? Math.max(pollIntervalMs, 30_000)
      : pollIntervalMs;
  }, [targetBranchId, enabled, pollIntervalMs, realtimeState]);

  const queueQuery = useQuery<OrderDetailResponse[], ApiError>({
    queryKey,
    queryFn: () => fetchQueue(targetBranchId!),
    enabled: Boolean(targetBranchId && enabled),
    staleTime: 10_000,
    refetchInterval: effectiveRefetchInterval,
    refetchIntervalInBackground: false,
  });

  const applyUpdatedOrder = useCallback(
    (updated: OrderDetailResponse) => {
      if (!targetBranchId) return;
      queryClient.setQueryData<OrderDetailResponse[]>(queryKey, (prev = []) => {
        const isStillOnBoard = LIVE_BOARD_ORDER_STATUSES.includes(
          updated.status
        );
        if (!isStillOnBoard) {
          knownOrderIdsRef.current.delete(updated.id);
          return prev.filter((item) => item.id !== updated.id);
        }

        const existed = prev.some((item) => item.id === updated.id);
        if (
          !existed &&
          updated.status === "Confirmed" &&
          !knownOrderIdsRef.current.has(updated.id) &&
          soundEnabledRef.current
        ) {
          playNewOrderChime();
        }
        knownOrderIdsRef.current.add(updated.id);

        return existed
          ? prev.map((item) => (item.id === updated.id ? updated : item))
          : [...prev, updated];
      });
    },
    [queryClient, queryKey, targetBranchId]
  );

  const applyItemPreparationPatch = useCallback(
    (
      orderId: string,
      orderItemId: string,
      patch?: OrderPreparationStatusResponse | null,
      fallbackStatus?: PreparationStatus
    ) => {
      if (!targetBranchId) return;
      queryClient.setQueryData<OrderDetailResponse[]>(queryKey, (prev = []) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const nextOrderStatus = patch?.orderStatus ?? order.status;
          const nextItems = order.orderItems.map((item) => {
            if (item.id !== orderItemId) return item;
            return {
              ...item,
              preparationStatus:
                patch?.currentStatus ??
                fallbackStatus ??
                item.preparationStatus,
              preparationStartedAt:
                patch?.startedAt !== undefined
                  ? patch.startedAt
                  : item.preparationStartedAt,
              preparationCompletedAt:
                patch?.completedAt !== undefined
                  ? patch.completedAt
                  : item.preparationCompletedAt,
            };
          });
          return {
            ...order,
            status: nextOrderStatus,
            orderItems: nextItems,
          };
        })
      );
    },
    [queryClient, queryKey, targetBranchId]
  );

  const syncSingleOrder = useCallback(
    async (orderId: string) => {
      try {
        const detail = await getOrderById(orderId);
        if (detail.data) {
          applyUpdatedOrder(detail.data);
        }
      } catch {
        await queryClient.invalidateQueries({ queryKey });
      }
    },
    [applyUpdatedOrder, queryClient, queryKey]
  );

  // SignalR real-time subscription with batched UI/cache updates
  useEffect(() => {
    if (!targetBranchId || !enabled) return;

    const handleBatchedEvents = async (events: OrderRealtimeEvent[]) => {
      const uniqueOrderIds = Array.from(
        new Set(
          events
            .map((e) => e.orderPublicId)
            .filter((id): id is string => Boolean(id))
        )
      );

      if (
        events.some((e) => e.eventType === "Reconnected") ||
        uniqueOrderIds.length === 0 ||
        uniqueOrderIds.length > 3
      ) {
        await queryClient.invalidateQueries({ queryKey });
        return;
      }

      await Promise.all(uniqueOrderIds.map((id) => syncSingleOrder(id)));
    };

    const unsubscribe = subscribeBranchOrdersRealtime({
      branchId: targetBranchId,
      onBatchedEvents: (events) => {
        void handleBatchedEvents(events);
      },
      onStateChange: (state) => {
        setRealtimeState(state);
      },
    });

    return unsubscribe;
  }, [targetBranchId, enabled, queryClient, queryKey, syncSingleOrder]);

  const refreshNow = useCallback(async () => {
    if (!targetBranchId || !enabled) return;
    await queryClient.invalidateQueries({ queryKey });
  }, [targetBranchId, enabled, queryClient, queryKey]);

  const handleStartPreparingOrder = useCallback(
    async (orderId: string) => {
      setBusyOrderIds((prev) => ({ ...prev, [orderId]: true }));
      const snapshot =
        queryClient.getQueryData<OrderDetailResponse[]>(queryKey);

      // Optimistic update: transition order & pending items to Preparing immediately
      queryClient.setQueryData<OrderDetailResponse[]>(queryKey, (prev = []) =>
        prev.map((order) =>
          order.id !== orderId
            ? order
            : {
                ...order,
                status: "Preparing",
                orderItems: order.orderItems.map((item) =>
                  item.preparationStatus === "Pending" ||
                  !item.preparationStatus
                    ? { ...item, preparationStatus: "Preparing" }
                    : item
                ),
              }
        )
      );

      try {
        const res = await startPreparingOrder(orderId);
        if (res.data) {
          applyUpdatedOrder(res.data);
        } else {
          await syncSingleOrder(orderId);
        }
        showFeedback(
          "success",
          `Đã bắt đầu chế biến đơn #${res.data?.orderCode ?? ""}.`
        );
      } catch (error) {
        if (snapshot) {
          queryClient.setQueryData(queryKey, snapshot);
        }
        showFeedback(
          "error",
          error instanceof ApiError
            ? error.message
            : "Không thể bắt đầu chế biến đơn hàng."
        );
      } finally {
        setBusyOrderIds((prev) => ({ ...prev, [orderId]: false }));
      }
    },
    [applyUpdatedOrder, queryClient, queryKey, showFeedback, syncSingleOrder]
  );

  const handleMarkOrderReady = useCallback(
    async (orderId: string) => {
      setBusyOrderIds((prev) => ({ ...prev, [orderId]: true }));
      const snapshot =
        queryClient.getQueryData<OrderDetailResponse[]>(queryKey);

      // Optimistic update: move order to Ready stage based on OrderType
      queryClient.setQueryData<OrderDetailResponse[]>(queryKey, (prev = []) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const nextStatus =
            order.type === "TakeAway"
              ? "ReadyForPickup"
              : order.type === "Delivery"
                ? "ReadyForDelivery"
                : "Served";
          return {
            ...order,
            status: nextStatus,
            orderItems: order.orderItems.map((item) =>
              item.preparationStatus !== "Cancelled"
                ? { ...item, preparationStatus: "Ready" }
                : item
            ),
          };
        })
      );

      try {
        const res = await markOrderReady(orderId);
        if (res.data) {
          applyUpdatedOrder(res.data);
        } else {
          await syncSingleOrder(orderId);
        }
        showFeedback(
          "success",
          `Đơn #${res.data?.orderCode ?? ""} đã hoàn tất chế biến (Ready).`
        );
      } catch (error) {
        if (snapshot) {
          queryClient.setQueryData(queryKey, snapshot);
        }
        showFeedback(
          "error",
          error instanceof ApiError
            ? error.message
            : "Không thể đánh dấu hoàn tất đơn hàng."
        );
      } finally {
        setBusyOrderIds((prev) => ({ ...prev, [orderId]: false }));
      }
    },
    [applyUpdatedOrder, queryClient, queryKey, showFeedback, syncSingleOrder]
  );

  const handleCancelOrder = useCallback(
    async (orderId: string, reason?: string): Promise<boolean> => {
      setBusyOrderIds((prev) => ({ ...prev, [orderId]: true }));
      const snapshot =
        queryClient.getQueryData<OrderDetailResponse[]>(queryKey);

      queryClient.setQueryData<OrderDetailResponse[]>(queryKey, (prev = []) =>
        prev.filter((item) => item.id !== orderId)
      );

      try {
        const res = await cancelOrder(orderId, reason);
        if (res.data) {
          applyUpdatedOrder(res.data);
        }
        showFeedback(
          "success",
          `Đã hủy đơn hàng #${res.data?.orderCode ?? ""}.`
        );
        return true;
      } catch (error) {
        if (snapshot) {
          queryClient.setQueryData(queryKey, snapshot);
        }
        showFeedback(
          "error",
          error instanceof ApiError
            ? error.message
            : "Không thể hủy đơn hàng."
        );
        return false;
      } finally {
        setBusyOrderIds((prev) => ({ ...prev, [orderId]: false }));
      }
    },
    [applyUpdatedOrder, queryClient, queryKey, showFeedback]
  );

  const handleRecallOrder = useCallback(
    async (order: OrderDetailResponse) => {
      setBusyOrderIds((prev) => ({ ...prev, [order.id]: true }));
      const snapshot =
        queryClient.getQueryData<OrderDetailResponse[]>(queryKey);

      queryClient.setQueryData<OrderDetailResponse[]>(queryKey, (prev = []) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, status: "Preparing" } : o
        )
      );

      try {
        await recallOrderToKitchen(order);
        await syncSingleOrder(order.id);
        showFeedback(
          "success",
          `Đã hoàn tác (Recall) đơn #${order.orderCode} quay lại trạng thái Đang chế biến.`
        );
      } catch (error) {
        if (snapshot) {
          queryClient.setQueryData(queryKey, snapshot);
        }
        showFeedback(
          "error",
          error instanceof ApiError
            ? error.message
            : "Không thể hoàn tác (Recall) đơn hàng."
        );
      } finally {
        setBusyOrderIds((prev) => ({ ...prev, [order.id]: false }));
      }
    },
    [queryClient, queryKey, showFeedback, syncSingleOrder]
  );

  const handleAdvanceItem = useCallback(
    async (orderId: string, orderItemId: string) => {
      setBusyItemIds((prev) => ({ ...prev, [orderItemId]: true }));
      const snapshot =
        queryClient.getQueryData<OrderDetailResponse[]>(queryKey);

      // Optimistic step advance
      const currentOrder = snapshot?.find((o) => o.id === orderId);
      const currentItem = currentOrder?.orderItems.find(
        (i) => i.id === orderItemId
      );
      if (currentItem) {
        const nextStatus: PreparationStatus =
          currentItem.preparationStatus === "Pending" ||
          !currentItem.preparationStatus
            ? "Preparing"
            : "Ready";
        applyItemPreparationPatch(orderId, orderItemId, null, nextStatus);
      }

      try {
        const res = await advanceOrderItem(orderItemId);
        if (res.data) {
          applyItemPreparationPatch(orderId, orderItemId, res.data);
        }
        await syncSingleOrder(orderId);
      } catch (error) {
        if (snapshot) {
          queryClient.setQueryData(queryKey, snapshot);
        }
        showFeedback(
          "error",
          error instanceof ApiError
            ? error.message
            : "Không thể chuyển tiếp trạng thái món."
        );
      } finally {
        setBusyItemIds((prev) => ({ ...prev, [orderItemId]: false }));
      }
    },
    [
      applyItemPreparationPatch,
      queryClient,
      queryKey,
      showFeedback,
      syncSingleOrder,
    ]
  );

  const handleRevertItem = useCallback(
    async (orderId: string, orderItemId: string) => {
      setBusyItemIds((prev) => ({ ...prev, [orderItemId]: true }));
      const snapshot =
        queryClient.getQueryData<OrderDetailResponse[]>(queryKey);

      const currentOrder = snapshot?.find((o) => o.id === orderId);
      const currentItem = currentOrder?.orderItems.find(
        (i) => i.id === orderItemId
      );
      if (currentItem) {
        const prevStatus: PreparationStatus =
          currentItem.preparationStatus === "Ready" ? "Preparing" : "Pending";
        applyItemPreparationPatch(orderId, orderItemId, null, prevStatus);
      }

      try {
        const res = await revertOrderItem(orderItemId);
        if (res.data) {
          applyItemPreparationPatch(orderId, orderItemId, res.data);
        }
        await syncSingleOrder(orderId);
      } catch (error) {
        if (snapshot) {
          queryClient.setQueryData(queryKey, snapshot);
        }
        showFeedback(
          "error",
          error instanceof ApiError
            ? error.message
            : "Không thể lùi trạng thái món."
        );
      } finally {
        setBusyItemIds((prev) => ({ ...prev, [orderItemId]: false }));
      }
    },
    [
      applyItemPreparationPatch,
      queryClient,
      queryKey,
      showFeedback,
      syncSingleOrder,
    ]
  );

  const handleUpdateItemStatus = useCallback(
    async (
      orderId: string,
      orderItemId: string,
      targetStatus: PreparationStatus
    ) => {
      setBusyItemIds((prev) => ({ ...prev, [orderItemId]: true }));
      const snapshot =
        queryClient.getQueryData<OrderDetailResponse[]>(queryKey);

      applyItemPreparationPatch(orderId, orderItemId, null, targetStatus);

      try {
        const res = await updateOrderItemStatus(orderItemId, targetStatus);
        if (res.data) {
          applyItemPreparationPatch(
            orderId,
            orderItemId,
            res.data,
            targetStatus
          );
        }
        await syncSingleOrder(orderId);
      } catch (error) {
        if (snapshot) {
          queryClient.setQueryData(queryKey, snapshot);
        }
        showFeedback(
          "error",
          error instanceof ApiError
            ? error.message
            : "Không thể cập nhật trạng thái món."
        );
      } finally {
        setBusyItemIds((prev) => ({ ...prev, [orderItemId]: false }));
      }
    },
    [
      applyItemPreparationPatch,
      queryClient,
      queryKey,
      showFeedback,
      syncSingleOrder,
    ]
  );

  const orders = useMemo(
    () => (targetBranchId && enabled ? (queueQuery.data ?? []) : []),
    [targetBranchId, enabled, queueQuery.data]
  );

  const connectionState: KdsConnectionState = queueQuery.isError
    ? "reconnecting"
    : queueQuery.isFetching
      ? "syncing"
      : realtimeState === "reconnecting"
        ? "reconnecting"
        : "online";

  const lastSyncedAt = queueQuery.dataUpdatedAt
    ? new Date(queueQuery.dataUpdatedAt)
    : null;

  const errorMessage = queueQuery.error
    ? queueQuery.error instanceof ApiError
      ? queueQuery.error.message
      : "Mất kết nối tạm thời tới máy chủ KDS. Đang tự động thử lại..."
    : null;

  return {
    orders,
    isLoading: queueQuery.isLoading,
    isRefreshing: queueQuery.isFetching && !queueQuery.isLoading,
    connectionState,
    lastSyncedAt,
    errorMessage,
    feedback,
    busyOrderIds,
    busyItemIds,
    refreshNow,
    dismissFeedback,
    handleStartPreparingOrder,
    handleMarkOrderReady,
    handleCancelOrder,
    handleRecallOrder,
    handleAdvanceItem,
    handleRevertItem,
    handleUpdateItemStatus,
  };
}
