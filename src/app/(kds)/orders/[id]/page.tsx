"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useKdsSession } from "@/features/auth/context/KdsSessionProvider";
import { CancelOrderModal } from "@/features/kitchen/components/CancelOrderModal";
import {
  advanceOrderItem,
  cancelOrder,
  confirmOrder,
  getOrderById,
  markOrderReady,
  recallOrderToKitchen,
  revertOrderItem,
  startPreparingOrder,
  updateOrderItemStatus,
} from "@/features/kitchen/services/kitchen.service";
import type {
  OrderDetailResponse,
  PreparationStatus,
} from "@/features/kitchen/types";
import {
  calculateSlaMetrics,
  canRecallOrder,
  DEFAULT_SLA_THRESHOLDS,
  formatCurrencyVnd,
  formatDateTimeVi,
  formatPrepDuration,
  getEffectivePrepStatus,
  getOrderStatusBadgeClass,
  getOrderStatusLabel,
  getOrderTypeBadgeClass,
  getOrderTypeLabel,
  getPaymentStatusBadgeClass,
  getPaymentStatusLabel,
  getPrepStatusBadgeClass,
  getPrepStatusLabel,
  getSlaBadgeClass,
  isOrderReadyStage,
  resolveTableDisplay,
} from "@/features/kitchen/utils/kitchen-helpers";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const PREP_STATUS_OPTIONS: PreparationStatus[] = [
  "Pending",
  "Preparing",
  "Ready",
  "Cancelled",
];

function OrderDetailPageContent() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const {
    tableMap,
    canUpdatePreparation,
    canCancelOrders,
    canConfirmOrders,
  } = useKdsSession();

  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderBusy, setIsOrderBusy] = useState(false);
  const [busyItemIds, setBusyItemIds] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchOrderData = useCallback(async (id: string) => {
    try {
      const res = await getOrderById(id);
      setOrder(res.data ?? null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Không thể tải thông tin chi tiết đơn hàng."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOrder = useCallback(
    async (silent = false) => {
      if (!orderId) return;
      if (!silent) setIsLoading(true);
      await fetchOrderData(orderId);
    },
    [orderId, fetchOrderData]
  );

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const init = async () => {
      if (cancelled) return;
      await fetchOrderData(orderId);
    };

    void init();
    const poll = window.setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") {
        void fetchOrderData(orderId);
      }
    }, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [orderId, fetchOrderData]);

  const handleConfirm = async () => {
    if (!order) return;
    setIsOrderBusy(true);
    try {
      const res = await confirmOrder(order.id);
      if (res.data) setOrder(res.data);
      else await loadOrder(true);
      setFeedback({
        type: "success",
        message: `Đã xác nhận đơn #${order.orderCode} sang Confirmed.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Không thể xác nhận đơn hàng.",
      });
    } finally {
      setIsOrderBusy(false);
    }
  };

  const handleStartPreparing = async () => {
    if (!order) return;
    setIsOrderBusy(true);
    try {
      const res = await startPreparingOrder(order.id);
      if (res.data) setOrder(res.data);
      else await loadOrder(true);
      setFeedback({
        type: "success",
        message: `Đã bắt đầu chế biến đơn #${order.orderCode}.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Không thể bắt đầu chế biến đơn hàng.",
      });
    } finally {
      setIsOrderBusy(false);
    }
  };

  const handleMarkReady = async () => {
    if (!order) return;
    setIsOrderBusy(true);
    try {
      const res = await markOrderReady(order.id);
      if (res.data) setOrder(res.data);
      else await loadOrder(true);
      setFeedback({
        type: "success",
        message: `Đơn #${order.orderCode} đã chuyển sang trạng thái hoàn tất chế biến.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Không thể đánh dấu hoàn tất đơn hàng.",
      });
    } finally {
      setIsOrderBusy(false);
    }
  };

  const handleRecall = async () => {
    if (!order) return;
    setIsOrderBusy(true);
    try {
      await recallOrderToKitchen(order);
      await loadOrder(true);
      setFeedback({
        type: "success",
        message: `Đã hoàn tác (Recall) đơn #${order.orderCode} về trạng thái Đang chế biến.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Không thể hoàn tác (Recall) đơn hàng.",
      });
    } finally {
      setIsOrderBusy(false);
    }
  };

  const handleCancelOrder = async (
    targetId: string,
    reason: string
  ): Promise<boolean> => {
    setIsOrderBusy(true);
    try {
      const res = await cancelOrder(targetId, reason);
      if (res.data) setOrder(res.data);
      else await loadOrder(true);
      setFeedback({
        type: "success",
        message: `Đã hủy đơn hàng #${order?.orderCode ?? ""}.`,
      });
      return true;
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Không thể hủy đơn hàng.",
      });
      return false;
    } finally {
      setIsOrderBusy(false);
    }
  };

  const handleAdvanceItem = async (itemId: string) => {
    setBusyItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await advanceOrderItem(itemId);
      await loadOrder(true);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Không thể chuyển tiếp trạng thái món.",
      });
    } finally {
      setBusyItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleRevertItem = async (itemId: string) => {
    setBusyItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await revertOrderItem(itemId);
      await loadOrder(true);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Không thể lùi trạng thái món.",
      });
    } finally {
      setBusyItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleUpdateItemStatus = async (
    itemId: string,
    status: PreparationStatus
  ) => {
    setBusyItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await updateOrderItemStatus(itemId, status);
      await loadOrder(true);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Không thể cập nhật trạng thái món.",
      });
    } finally {
      setBusyItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (errorMessage || !order) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          Không tìm thấy đơn hàng
        </h1>
        <p className="mt-1 text-sm text-rose-600">
          {errorMessage || "Đơn hàng không tồn tại hoặc đã bị xóa."}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600"
          >
            &larr; Về Bảng điều phối bếp
          </Link>
          <Link
            href="/history"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Xem Lịch sử
          </Link>
        </div>
      </div>
    );
  }

  const tableInfo = resolveTableDisplay(order.restaurantTableId, tableMap);
  const sla = calculateSlaMetrics(order, nowMs, DEFAULT_SLA_THRESHOLDS);
  const canModifyItems =
    canUpdatePreparation &&
    (order.status === "Confirmed" ||
      order.status === "Preparing" ||
      isOrderReadyStage(order.status));

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100"
          >
            &larr; Bếp (Live Board)
          </Link>
          <Link
            href="/history"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100"
          >
            Lịch sử &amp; Recall
          </Link>
        </div>

        <button
          type="button"
          onClick={() => void loadOrder(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          ↻ Tải lại dữ liệu đơn
        </button>
      </div>

      {feedback && (
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium",
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          )}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded px-2 py-0.5 text-[11px] font-semibold hover:bg-black/5"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Order Summary Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-extrabold text-slate-900">
                Đơn #{order.orderCode}
              </h1>
              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold",
                  getOrderTypeBadgeClass(order.type)
                )}
              >
                {getOrderTypeLabel(order.type)}
              </span>
              {order.type === "DineIn" && tableInfo && (
                <span className="rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 font-mono text-xs font-bold text-indigo-800">
                  {tableInfo.tableLabel}
                  {tableInfo.areaLabel ? ` (${tableInfo.areaLabel})` : ""}
                </span>
              )}
              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold",
                  getOrderStatusBadgeClass(order.status)
                )}
              >
                {getOrderStatusLabel(order.status)}
              </span>
              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold",
                  getPaymentStatusBadgeClass(order.paymentStatus)
                )}
              >
                {getPaymentStatusLabel(
                  order.paymentStatus,
                  order.paymentTiming
                )}
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Mã định danh: <code className="font-mono">{order.id}</code> &bull;
              Tạo lúc: {formatDateTimeVi(order.createdAt)} &bull; Cập nhật:{" "}
              {formatDateTimeVi(order.updatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(order.status === "Confirmed" || order.status === "Preparing") && (
              <span
                className={cn(
                  "rounded-xl border px-3 py-1.5 font-mono text-sm font-bold",
                  getSlaBadgeClass(sla.level)
                )}
              >
                SLA: {sla.formattedTimer}
              </span>
            )}

            {canConfirmOrders && order.status === "Pending" && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => void handleConfirm()}
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                Xác nhận đơn (Confirm)
              </button>
            )}

            {canUpdatePreparation && order.status === "Confirmed" && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => void handleStartPreparing()}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {isOrderBusy ? "Đang xử lý..." : "Bắt đầu nấu cả đơn"}
              </button>
            )}

            {canUpdatePreparation && order.status === "Preparing" && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => void handleMarkReady()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isOrderBusy ? "Đang xử lý..." : "Hoàn tất cả đơn ✓"}
              </button>
            )}

            {canUpdatePreparation && canRecallOrder(order) && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => void handleRecall()}
                className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
              >
                ↺ Recall về bếp
              </button>
            )}

            {canCancelOrders &&
              order.status !== "Completed" &&
              order.status !== "Cancelled" && (
                <button
                  type="button"
                  disabled={isOrderBusy}
                  onClick={() => setIsCancelModalOpen(true)}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  {order.status === "Preparing"
                    ? "Hủy đơn (Cảnh báo Waste)"
                    : "Hủy đơn"}
                </button>
              )}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">Bàn / Địa chỉ nhận</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {order.type === "DineIn"
                ? tableInfo
                  ? `${tableInfo.tableLabel}${
                      tableInfo.areaLabel ? ` • ${tableInfo.areaLabel}` : ""
                    }`
                  : "Ăn tại bàn"
                : order.type === "TakeAway"
                  ? "Khách lấy tại quầy (Take Away)"
                  : order.deliveryAddress || "Giao hàng tận nơi"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">Tổng số món</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {order.orderItems.length} dòng món (
              {order.orderItems.reduce((sum, i) => sum + i.quantity, 0)} phần)
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">Tạm tính / Giảm giá</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatCurrencyVnd(order.subtotal)}{" "}
              {order.discountAmount > 0 && (
                <span className="text-xs font-medium text-emerald-700">
                  (-{formatCurrencyVnd(order.discountAmount)}
                  {order.voucherCode ? ` · ${order.voucherCode}` : ""})
                </span>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">Tổng thanh toán</p>
            <p className="mt-1 text-base font-extrabold text-slate-900">
              {formatCurrencyVnd(order.totalAmount)}
            </p>
          </div>
        </div>

        {order.note && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
            <span className="font-bold">Ghi chú đơn hàng: </span>
            <span>{order.note}</span>
          </div>
        )}

        {order.status === "Preparing" && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-900">
            <span className="font-bold text-rose-800">
              Lưu ý hủy đơn khi đang nấu (Preparing):
            </span>{" "}
            Nguyên liệu đã được xuất kho (<code className="font-mono">Deduct</code>
            ). Nếu hủy đơn ở trạng thái này, hệ thống{" "}
            <span className="font-semibold underline">không hoàn kho</span> và
            ghi nhận hao hụt (<span className="font-semibold">Waste</span>).
          </div>
        )}
      </section>

      {/* Order Items & Preparation Timestamps */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Danh sách món &amp; Lịch sử thời gian chế biến
            </h2>
            <p className="text-xs text-slate-500">
              Theo dõi thời điểm bắt đầu nấu (StartedAt), hoàn thành
              (CompletedAt) và điều chỉnh trực tiếp trạng thái từng món.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {order.orderItems.map((item) => {
            const prepStatus = getEffectivePrepStatus(item, order.status);
            const isItemBusy = Boolean(busyItemIds[item.id]) || isOrderBusy;
            const duration = formatPrepDuration(
              item.preparationStartedAt,
              item.preparationCompletedAt
            );

            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex min-w-9 items-center justify-center rounded-xl bg-slate-900 px-2.5 py-1 font-mono text-sm font-bold text-white">
                      &times;{item.quantity}
                    </span>
                    <div>
                      <p
                        className={cn(
                          "text-base font-bold text-slate-900",
                          prepStatus === "Cancelled" &&
                            "line-through text-slate-400"
                        )}
                      >
                        {item.productName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Đơn giá: {formatCurrencyVnd(item.unitPrice)} &bull;
                        Thành tiền:{" "}
                        <span className="font-semibold text-slate-800">
                          {formatCurrencyVnd(item.lineTotal)}
                        </span>
                      </p>
                      {item.note && (
                        <p className="mt-1.5 inline-block rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                          Ghi chú món: {item.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-lg border px-3 py-1 text-xs font-bold",
                      getPrepStatusBadgeClass(prepStatus)
                    )}
                  >
                    {getPrepStatusLabel(prepStatus)}
                  </span>
                </div>

                {/* Preparation Timestamps */}
                <div className="mt-3 grid gap-2 rounded-xl border border-slate-200/80 bg-white p-3 text-xs sm:grid-cols-3">
                  <div>
                    <span className="text-slate-400">StartedAt: </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatDateTimeVi(item.preparationStartedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">CompletedAt: </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatDateTimeVi(item.preparationCompletedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Thời gian chế biến: </span>
                    <span className="font-bold text-amber-700">
                      {duration ?? "—"}
                    </span>
                  </div>
                </div>

                {/* Item Controls */}
                {canModifyItems && prepStatus !== "Cancelled" && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-500">
                        Chuyển đích danh:
                      </span>
                      {PREP_STATUS_OPTIONS.map((targetStatus) => {
                        const isCurrent = prepStatus === targetStatus;
                        return (
                          <button
                            key={targetStatus}
                            type="button"
                            disabled={isCurrent || isItemBusy}
                            onClick={() =>
                              void handleUpdateItemStatus(item.id, targetStatus)
                            }
                            className={cn(
                              "rounded-lg border px-2.5 py-1 text-xs font-semibold transition",
                              isCurrent
                                ? "border-slate-900 bg-slate-900 text-white"
                                : targetStatus === "Cancelled"
                                  ? "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                              isItemBusy && "opacity-50"
                            )}
                          >
                            {getPrepStatusLabel(targetStatus)}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      {(prepStatus === "Preparing" ||
                        prepStatus === "Ready") && (
                        <button
                          type="button"
                          disabled={isItemBusy}
                          onClick={() => void handleRevertItem(item.id)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          &#8630; Revert
                        </button>
                      )}
                      {(prepStatus === "Pending" ||
                        prepStatus === "Preparing") && (
                        <button
                          type="button"
                          disabled={isItemBusy}
                          onClick={() => void handleAdvanceItem(item.id)}
                          className="rounded-lg bg-amber-500 px-3.5 py-1 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          Advance &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <CancelOrderModal
        order={isCancelModalOpen ? order : null}
        isBusy={isOrderBusy}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirmCancel={handleCancelOrder}
      />
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      }
    >
      <OrderDetailPageContent />
    </Suspense>
  );
}
