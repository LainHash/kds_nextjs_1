"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
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

interface BranchQueueState {
  branchId: string | null;
  orders: OrderDetailResponse[];
  lastSyncedAt: Date | null;
  errorMessage: string | null;
}

export function useKitchenQueue({
  branchId,
  pollIntervalMs = 5000,
  soundEnabled = true,
  enabled = true,
}: UseKitchenQueueOptions) {
  const targetBranchId = branchId ?? null;

  const [queueState, setQueueState] = useState<BranchQueueState>({
    branchId: null,
    orders: [],
    lastSyncedAt: null,
    errorMessage: null,
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [connectionState, setConnectionState] =
    useState<KdsConnectionState>("online");
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

  const performFetch = useCallback(async (branchToLoad: string) => {
    try {
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
          (o) =>
            o.status === "Confirmed" && !knownOrderIdsRef.current.has(o.id)
        );
        if (hasNewConfirmedOrder && soundEnabledRef.current) {
          playNewOrderChime();
        }
      }

      knownOrderIdsRef.current = new Set(nextOrders.map((o) => o.id));
      loadedBranchRef.current = branchToLoad;

      setQueueState({
        branchId: branchToLoad,
        orders: nextOrders,
        lastSyncedAt: new Date(),
        errorMessage: null,
      });
      setConnectionState("online");
    } catch (error) {
      loadedBranchRef.current = branchToLoad;
      setConnectionState("reconnecting");
      setQueueState((prev) => ({
        branchId: branchToLoad,
        orders: prev.branchId === branchToLoad ? prev.orders : [],
        lastSyncedAt: prev.branchId === branchToLoad ? prev.lastSyncedAt : null,
        errorMessage:
          error instanceof ApiError
            ? error.message
            : "Mất kết nối tạm thời tới máy chủ KDS. Đang tự động thử lại...",
      }));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const refreshNow = useCallback(async () => {
    if (!targetBranchId || !enabled) return;
    setIsRefreshing(true);
    setConnectionState((prev) =>
      prev === "reconnecting" ? "reconnecting" : "syncing"
    );
    await performFetch(targetBranchId);
  }, [targetBranchId, enabled, performFetch]);

  useEffect(() => {
    if (!targetBranchId || !enabled) return;

    let cancelled = false;

    const runInitialAndPoll = async () => {
      if (cancelled) return;
      await performFetch(targetBranchId);
    };

    void runInitialAndPoll();

    if (pollIntervalMs <= 0) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") {
        setIsRefreshing(true);
        void performFetch(targetBranchId);
      }
    }, pollIntervalMs);

    const handleVisibilityChange = () => {
      if (!cancelled && document.visibilityState === "visible") {
        setIsRefreshing(true);
        void performFetch(targetBranchId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [targetBranchId, enabled, pollIntervalMs, performFetch]);

  const applyUpdatedOrder = useCallback(
    (updated: OrderDetailResponse) => {
      setQueueState((prev) => {
        if (prev.branchId !== targetBranchId) return prev;
        const isStillOnBoard = LIVE_BOARD_ORDER_STATUSES.includes(
          updated.status
        );
        const nextOrders = !isStillOnBoard
          ? prev.orders.filter((item) => item.id !== updated.id)
          : prev.orders.some((item) => item.id === updated.id)
            ? prev.orders.map((item) =>
                item.id === updated.id ? updated : item
              )
            : [...prev.orders, updated];

        return {
          ...prev,
          orders: nextOrders,
          lastSyncedAt: new Date(),
        };
      });
    },
    [targetBranchId]
  );

  const applyItemPreparationPatch = useCallback(
    (
      orderId: string,
      orderItemId: string,
      patch?: OrderPreparationStatusResponse | null,
      fallbackStatus?: PreparationStatus
    ) => {
      setQueueState((prev) => {
        if (prev.branchId !== targetBranchId) return prev;
        return {
          ...prev,
          orders: prev.orders.map((order) => {
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
          }),
        };
      });
    },
    [targetBranchId]
  );

  const syncSingleOrder = useCallback(
    async (orderId: string) => {
      try {
        const detail = await getOrderById(orderId);
        if (detail.data) {
          applyUpdatedOrder(detail.data);
        }
      } catch {
        if (targetBranchId) {
          await performFetch(targetBranchId);
        }
      }
    },
    [applyUpdatedOrder, performFetch, targetBranchId]
  );

  const handleStartPreparingOrder = useCallback(
    async (orderId: string) => {
      setBusyOrderIds((prev) => ({ ...prev, [orderId]: true }));
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
    [applyUpdatedOrder, showFeedback, syncSingleOrder]
  );

  const handleMarkOrderReady = useCallback(
    async (orderId: string) => {
      setBusyOrderIds((prev) => ({ ...prev, [orderId]: true }));
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
    [applyUpdatedOrder, showFeedback, syncSingleOrder]
  );

  const handleCancelOrder = useCallback(
    async (orderId: string, reason?: string): Promise<boolean> => {
      setBusyOrderIds((prev) => ({ ...prev, [orderId]: true }));
      try {
        const res = await cancelOrder(orderId, reason);
        if (res.data) {
          applyUpdatedOrder(res.data);
        } else {
          setQueueState((prev) => ({
            ...prev,
            orders: prev.orders.filter((item) => item.id !== orderId),
          }));
        }
        showFeedback(
          "success",
          `Đã hủy đơn hàng #${res.data?.orderCode ?? ""}.`
        );
        return true;
      } catch (error) {
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
    [applyUpdatedOrder, showFeedback]
  );

  const handleRecallOrder = useCallback(
    async (order: OrderDetailResponse) => {
      setBusyOrderIds((prev) => ({ ...prev, [order.id]: true }));
      try {
        await recallOrderToKitchen(order);
        await syncSingleOrder(order.id);
        showFeedback(
          "success",
          `Đã hoàn tác (Recall) đơn #${order.orderCode} quay lại trạng thái Đang chế biến.`
        );
      } catch (error) {
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
    [showFeedback, syncSingleOrder]
  );

  const handleAdvanceItem = useCallback(
    async (orderId: string, orderItemId: string) => {
      setBusyItemIds((prev) => ({ ...prev, [orderItemId]: true }));
      try {
        const res = await advanceOrderItem(orderItemId);
        if (res.data) {
          applyItemPreparationPatch(orderId, orderItemId, res.data);
        }
        await syncSingleOrder(orderId);
      } catch (error) {
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
    [applyItemPreparationPatch, showFeedback, syncSingleOrder]
  );

  const handleRevertItem = useCallback(
    async (orderId: string, orderItemId: string) => {
      setBusyItemIds((prev) => ({ ...prev, [orderItemId]: true }));
      try {
        const res = await revertOrderItem(orderItemId);
        if (res.data) {
          applyItemPreparationPatch(orderId, orderItemId, res.data);
        }
        await syncSingleOrder(orderId);
      } catch (error) {
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
    [applyItemPreparationPatch, showFeedback, syncSingleOrder]
  );

  const handleUpdateItemStatus = useCallback(
    async (
      orderId: string,
      orderItemId: string,
      targetStatus: PreparationStatus
    ) => {
      setBusyItemIds((prev) => ({ ...prev, [orderItemId]: true }));
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
    [applyItemPreparationPatch, showFeedback, syncSingleOrder]
  );

  const orders = useMemo(
    () =>
      targetBranchId && queueState.branchId === targetBranchId
        ? queueState.orders
        : [],
    [targetBranchId, queueState]
  );

  const isLoading = Boolean(
    targetBranchId && enabled && queueState.branchId !== targetBranchId
  );

  const lastSyncedAt =
    targetBranchId && queueState.branchId === targetBranchId
      ? queueState.lastSyncedAt
      : null;

  const errorMessage =
    targetBranchId && queueState.branchId === targetBranchId
      ? queueState.errorMessage
      : null;

  return {
    orders,
    isLoading,
    isRefreshing,
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
