"use client";

import Link from "next/link";
import type { TableLookupEntry } from "@/features/territory/types";
import { cn } from "@/lib/utils";
import type {
  OrderDetailResponse,
  PreparationStatus,
  SlaThresholdConfig,
} from "../types";
import {
  calculateSlaMetrics,
  canRecallOrder,
  DEFAULT_SLA_THRESHOLDS,
  formatPrepDuration,
  formatTimeShort,
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
  getSlaCardBorderClass,
  isOrderReadyStage,
  resolveTableDisplay,
} from "../utils/kitchen-helpers";

interface OrderTicketCardProps {
  order: OrderDetailResponse;
  nowMs: number;
  tableMap: Record<string, TableLookupEntry>;
  slaThresholds?: SlaThresholdConfig;
  canUpdatePreparation: boolean;
  canCancelOrders: boolean;
  isOrderBusy?: boolean;
  busyItemIds?: Record<string, boolean>;
  onOpenDetail: (order: OrderDetailResponse) => void;
  onStartPreparingOrder: (orderId: string) => void;
  onMarkOrderReady: (orderId: string) => void;
  onRequestCancelOrder: (order: OrderDetailResponse) => void;
  onRecallOrder: (order: OrderDetailResponse) => void;
  onAdvanceItem: (orderId: string, orderItemId: string) => void;
  onRevertItem: (orderId: string, orderItemId: string) => void;
  onUpdateItemStatus: (
    orderId: string,
    orderItemId: string,
    status: PreparationStatus
  ) => void;
}

export function OrderTicketCard({
  order,
  nowMs,
  tableMap,
  slaThresholds = DEFAULT_SLA_THRESHOLDS,
  canUpdatePreparation,
  canCancelOrders,
  isOrderBusy = false,
  busyItemIds = {},
  onOpenDetail,
  onStartPreparingOrder,
  onMarkOrderReady,
  onRequestCancelOrder,
  onRecallOrder,
  onAdvanceItem,
  onRevertItem,
  onUpdateItemStatus,
}: OrderTicketCardProps) {
  const sla = calculateSlaMetrics(order, nowMs, slaThresholds);
  const tableInfo = resolveTableDisplay(order.restaurantTableId, tableMap);
  const isReadyStage = isOrderReadyStage(order.status);

  const activeItems = order.orderItems.filter(
    (item) => getEffectivePrepStatus(item, order.status) !== "Cancelled"
  );
  const readyItemsCount = activeItems.filter(
    (item) => getEffectivePrepStatus(item, order.status) === "Ready"
  ).length;
  const preparingItemsCount = activeItems.filter(
    (item) => getEffectivePrepStatus(item, order.status) === "Preparing"
  ).length;

  return (
    <article
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition",
        getSlaCardBorderClass(sla.level, order.status)
      )}
    >
      <div className="space-y-3">
        {/* Ticket Header */}
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenDetail(order)}
                className="font-mono text-base font-extrabold tracking-tight text-slate-900 hover:text-amber-600"
                title="Mở chi tiết đơn hàng"
              >
                #{order.orderCode}
              </button>
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                  getOrderTypeBadgeClass(order.type)
                )}
              >
                {getOrderTypeLabel(order.type)}
              </span>
              {order.type === "DineIn" && tableInfo && (
                <span className="rounded-md border border-indigo-300 bg-indigo-100/80 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-900">
                  {tableInfo.tableLabel}
                  {tableInfo.areaLabel ? ` • ${tableInfo.areaLabel}` : ""}
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span>Lúc {formatTimeShort(order.createdAt)}</span>
              <span>&bull;</span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                  getPaymentStatusBadgeClass(order.paymentStatus)
                )}
              >
                {getPaymentStatusLabel(
                  order.paymentStatus,
                  order.paymentTiming
                )}
              </span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                  getOrderStatusBadgeClass(order.status)
                )}
              >
                {getOrderStatusLabel(order.status)}
              </span>
            </div>
          </div>

          {/* SLA Timer */}
          <div className="flex flex-col items-end">
            <span
              className={cn(
                "rounded-lg border px-2.5 py-1 font-mono text-xs font-bold tracking-wider shadow-2xs",
                isReadyStage
                  ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                  : getSlaBadgeClass(sla.level)
              )}
              title={
                isReadyStage
                  ? "Đơn đã nấu xong"
                  : sla.level === "critical"
                    ? `Quá hạn SLA (> ${slaThresholds.criticalMinutes} phút)`
                    : sla.level === "warning"
                      ? `Sắp trễ SLA (> ${slaThresholds.warningMinutes} phút)`
                      : "Trong ngưỡng SLA chuẩn"
              }
            >
              {isReadyStage ? "XONG" : sla.formattedTimer}
            </span>
            <span className="mt-1 text-[10px] font-medium text-slate-500">
              {readyItemsCount}/{activeItems.length} món xong
              {preparingItemsCount > 0
                ? ` (${preparingItemsCount} đang nấu)`
                : ""}
            </span>
          </div>
        </div>

        {/* Order Note & Delivery Address */}
        {order.note && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
            <span className="font-bold">Ghi chú đơn: </span>
            <span>{order.note}</span>
          </div>
        )}

        {order.type === "Delivery" && order.deliveryAddress && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-[11px] text-sky-900">
            <span className="font-semibold">Giao tới: </span>
            <span>{order.deliveryAddress}</span>
          </div>
        )}

        {/* Order Items List */}
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/90 bg-slate-50/60">
          {order.orderItems.map((item) => {
            const prepStatus = getEffectivePrepStatus(item, order.status);
            const isItemBusy = Boolean(busyItemIds[item.id]) || isOrderBusy;
            const canAdvance =
              canUpdatePreparation &&
              (prepStatus === "Pending" || prepStatus === "Preparing");
            const canRevert =
              canUpdatePreparation &&
              (prepStatus === "Preparing" || prepStatus === "Ready");
            const canCancelItem =
              canUpdatePreparation &&
              (prepStatus === "Pending" || prepStatus === "Preparing") &&
              !isReadyStage;
            const prepDuration = formatPrepDuration(
              item.preparationStartedAt,
              item.preparationCompletedAt
            );

            return (
              <li
                key={item.id}
                className={cn(
                  "flex flex-col gap-2 p-2.5 transition",
                  prepStatus === "Ready"
                    ? "bg-emerald-50/50"
                    : prepStatus === "Preparing"
                      ? "bg-amber-50/40"
                      : prepStatus === "Cancelled"
                        ? "bg-slate-100/70 opacity-60"
                        : "bg-white/70"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    disabled={!canAdvance || isItemBusy}
                    onClick={() => {
                      if (canAdvance && !isItemBusy) {
                        onAdvanceItem(order.id, item.id);
                      }
                    }}
                    className={cn(
                      "flex flex-1 items-start gap-2 text-left",
                      canAdvance && !isItemBusy
                        ? "cursor-pointer group"
                        : "cursor-default"
                    )}
                    title={
                      canAdvance
                        ? prepStatus === "Pending"
                          ? "Bấm để bắt đầu nấu món này (Pending -> Preparing)"
                          : "Bấm để đánh dấu món đã nấu xong (Preparing -> Ready)"
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "inline-flex min-w-7 items-center justify-center rounded-lg px-1.5 py-0.5 font-mono text-xs font-extrabold",
                        prepStatus === "Ready"
                          ? "bg-emerald-600 text-white"
                          : prepStatus === "Preparing"
                            ? "bg-amber-500 text-white"
                            : prepStatus === "Cancelled"
                              ? "bg-slate-300 text-slate-600"
                              : "bg-slate-900 text-white group-hover:bg-amber-600"
                      )}
                    >
                      &times;{item.quantity}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-semibold text-slate-900",
                          prepStatus === "Cancelled" &&
                            "line-through text-slate-500",
                          canAdvance &&
                            !isItemBusy &&
                            "group-hover:text-amber-700"
                        )}
                      >
                        {item.productName}
                      </p>

                      {item.note && (
                        <p className="mt-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200/80">
                          Ghi chú món: {item.note}
                        </p>
                      )}

                      {prepDuration && (
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          Thời gian nấu: {prepDuration}
                        </p>
                      )}
                    </div>
                  </button>

                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                      getPrepStatusBadgeClass(prepStatus)
                    )}
                  >
                    {getPrepStatusLabel(prepStatus)}
                  </span>
                </div>

                {/* Item Action Bar */}
                {canUpdatePreparation && prepStatus !== "Cancelled" && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-0.5">
                    {canRevert && (
                      <button
                        type="button"
                        disabled={isItemBusy}
                        onClick={() => onRevertItem(order.id, item.id)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                        title="Lùi 1 bước trạng thái món (Revert)"
                      >
                        &#8630; Lùi
                      </button>
                    )}

                    {canCancelItem && (
                      <button
                        type="button"
                        disabled={isItemBusy}
                        onClick={() =>
                          onUpdateItemStatus(order.id, item.id, "Cancelled")
                        }
                        className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        title="Báo hủy món này"
                      >
                        Hủy món
                      </button>
                    )}

                    {canAdvance && (
                      <button
                        type="button"
                        disabled={isItemBusy}
                        onClick={() => onAdvanceItem(order.id, item.id)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs transition disabled:opacity-50",
                          prepStatus === "Pending"
                            ? "bg-amber-500 hover:bg-amber-600"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        )}
                      >
                        {isItemBusy
                          ? "Đang xử lý..."
                          : prepStatus === "Pending"
                            ? "Bắt đầu nấu →"
                            : "Báo xong ✓"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Ticket Footer Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenDetail(order)}
            className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Chi tiết
          </button>

          <Link
            href={`/orders/${order.id}`}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            title="Mở trang chi tiết đơn hàng"
          >
            Mở trang &#8599;
          </Link>

          {canCancelOrders &&
            (order.status === "Confirmed" || order.status === "Preparing") && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => onRequestCancelOrder(order)}
                className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                {order.status === "Preparing" ? "Hủy (Waste)" : "Hủy đơn"}
              </button>
            )}
        </div>

        {canUpdatePreparation && (
          <div className="flex items-center gap-1.5">
            {order.status === "Confirmed" && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => onStartPreparingOrder(order.id)}
                className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-amber-600 disabled:opacity-50"
              >
                {isOrderBusy ? "Đang xử lý..." : "Bắt đầu nấu cả đơn"}
              </button>
            )}

            {order.status === "Preparing" && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => onMarkOrderReady(order.id)}
                className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {isOrderBusy ? "Đang xử lý..." : "Hoàn tất cả đơn ✓"}
              </button>
            )}

            {canRecallOrder(order) && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => onRecallOrder(order)}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                title="Đưa đơn vừa báo xong quay lại bếp (Preparing)"
              >
                {isOrderBusy ? "Đang hoàn tác..." : "↺ Recall về bếp"}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

