"use client";

import Link from "next/link";
import type { TableLookupEntry } from "@/features/territory/types";
import { cn } from "@/lib/utils";
import type { OrderDetailResponse, PreparationStatus } from "../types";
import {
  canRecallOrder,
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
  resolveTableDisplay,
} from "../utils/kitchen-helpers";

const PREP_STATUS_OPTIONS: PreparationStatus[] = [
  "Pending",
  "Preparing",
  "Ready",
  "Cancelled",
];

interface OrderDetailDrawerProps {
  order: OrderDetailResponse | null;
  tableMap: Record<string, TableLookupEntry>;
  canUpdatePreparation: boolean;
  canCancelOrders: boolean;
  isOrderBusy?: boolean;
  busyItemIds?: Record<string, boolean>;
  onClose: () => void;
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

export function OrderDetailDrawer({
  order,
  tableMap,
  canUpdatePreparation,
  canCancelOrders,
  isOrderBusy = false,
  busyItemIds = {},
  onClose,
  onStartPreparingOrder,
  onMarkOrderReady,
  onRequestCancelOrder,
  onRecallOrder,
  onAdvanceItem,
  onRevertItem,
  onUpdateItemStatus,
}: OrderDetailDrawerProps) {
  if (!order) return null;

  const tableInfo = resolveTableDisplay(order.restaurantTableId, tableMap);
  const canModifyItems =
    canUpdatePreparation &&
    (order.status === "Confirmed" ||
      order.status === "Preparing" ||
      order.status === "Served" ||
      order.status === "ReadyForPickup" ||
      order.status === "ReadyForDelivery");

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-drawer-title"
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
      >
        {/* Drawer Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="order-detail-drawer-title"
                className="font-mono text-xl font-extrabold text-slate-900"
              >
                Đơn #{order.orderCode}
              </h2>
              <span
                className={cn(
                  "rounded-md border px-2.5 py-0.5 text-xs font-semibold",
                  getOrderTypeBadgeClass(order.type)
                )}
              >
                {getOrderTypeLabel(order.type)}
              </span>
              {order.type === "DineIn" && tableInfo && (
                <span className="rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-800">
                  {tableInfo.tableLabel}
                  {tableInfo.areaLabel ? ` (${tableInfo.areaLabel})` : ""}
                </span>
              )}
              <span
                className={cn(
                  "rounded-md border px-2.5 py-0.5 text-xs font-semibold",
                  getOrderStatusBadgeClass(order.status)
                )}
              >
                {getOrderStatusLabel(order.status)}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Tạo lúc: {formatDateTimeVi(order.createdAt)} &bull; Cập nhật:{" "}
              {formatDateTimeVi(order.updatedAt)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/orders/${order.id}`}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Mở trang riêng &#8599;
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Metadata Grid */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Thanh toán</p>
              <div className="mt-1">
                <span
                  className={cn(
                    "inline-block rounded-md border px-2 py-0.5 text-xs font-semibold",
                    getPaymentStatusBadgeClass(order.paymentStatus)
                  )}
                >
                  {getPaymentStatusLabel(
                    order.paymentStatus,
                    order.paymentTiming
                  )}
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-900">
                Tổng: {formatCurrencyVnd(order.totalAmount)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Vị trí / Giao nhận</p>
              <p className="mt-1 text-xs font-semibold text-slate-900">
                {order.type === "DineIn"
                  ? tableInfo
                    ? `${tableInfo.tableLabel}${
                        tableInfo.areaLabel ? ` • ${tableInfo.areaLabel}` : ""
                      }`
                    : "Ăn tại bàn"
                  : order.type === "TakeAway"
                    ? "Khách nhận tại quầy"
                    : "Giao hàng tận nơi"}
              </p>
              {order.deliveryAddress && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">
                  {order.deliveryAddress}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Chi tiết giá</p>
              <p className="mt-1 text-xs text-slate-700">
                Tạm tính:{" "}
                <span className="font-semibold">
                  {formatCurrencyVnd(order.subtotal)}
                </span>
              </p>
              {order.discountAmount > 0 && (
                <p className="text-[11px] text-emerald-700">
                  Giảm: -{formatCurrencyVnd(order.discountAmount)}
                  {order.voucherCode ? ` (${order.voucherCode})` : ""}
                </p>
              )}
              {order.deliveryFee > 0 && (
                <p className="text-[11px] text-slate-600">
                  Phí giao: +{formatCurrencyVnd(order.deliveryFee)}
                </p>
              )}
            </div>
          </div>

          {/* Order Note */}
          {order.note && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
              <p className="font-bold text-amber-800">Ghi chú đơn hàng:</p>
              <p className="mt-1 leading-relaxed">{order.note}</p>
            </div>
          )}

          {/* Waste Warning Banner if Preparing */}
          {order.status === "Preparing" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
              <span className="font-semibold">Lưu ý tồn kho:</span> Đơn đang ở
              trạng thái <span className="font-bold">Preparing</span> (đã trừ kho
              nguyên liệu). Nếu thực hiện hủy đơn lúc này, nguyên liệu sẽ được
              tính vào <span className="font-bold text-rose-700">Waste</span> và
              không hoàn kho.
            </div>
          )}

          {/* Items & Preparation History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Danh sách món &amp; Tiến trình chế biến (
                {order.orderItems.length})
              </h3>
              <span className="text-xs text-slate-500">
                Chuyển trực tiếp hoặc Advance / Revert từng món
              </span>
            </div>

            <div className="space-y-3">
              {order.orderItems.map((item) => {
                const prepStatus = getEffectivePrepStatus(item, order.status);
                const isItemBusy =
                  Boolean(busyItemIds[item.id]) || isOrderBusy;
                const duration = formatPrepDuration(
                  item.preparationStartedAt,
                  item.preparationCompletedAt
                );

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="inline-flex min-w-8 items-center justify-center rounded-lg bg-slate-900 px-2 py-1 font-mono text-xs font-bold text-white">
                          &times;{item.quantity}
                        </span>
                        <div>
                          <p
                            className={cn(
                              "text-sm font-bold text-slate-900",
                              prepStatus === "Cancelled" &&
                                "line-through text-slate-400"
                            )}
                          >
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Đơn giá: {formatCurrencyVnd(item.unitPrice)} &bull;
                            Thành tiền:{" "}
                            <span className="font-semibold text-slate-700">
                              {formatCurrencyVnd(item.lineTotal)}
                            </span>
                          </p>
                          {item.note && (
                            <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
                              Ghi chú món: {item.note}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-bold",
                          getPrepStatusBadgeClass(prepStatus)
                        )}
                      >
                        {getPrepStatusLabel(prepStatus)}
                      </span>
                    </div>

                    {/* Timestamps */}
                    <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 sm:grid-cols-3">
                      <div>
                        <span className="text-slate-400">Bắt đầu nấu: </span>
                        <span className="font-medium text-slate-800">
                          {formatDateTimeVi(item.preparationStartedAt)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Hoàn thành: </span>
                        <span className="font-medium text-slate-800">
                          {formatDateTimeVi(item.preparationCompletedAt)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Thời lượng: </span>
                        <span className="font-semibold text-slate-900">
                          {duration ?? "—"}
                        </span>
                      </div>
                    </div>

                    {/* Direct Status Controls */}
                    {canModifyItems && prepStatus !== "Cancelled" && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="mr-1 text-[11px] font-medium text-slate-500">
                            Đặt trạng thái:
                          </span>
                          {PREP_STATUS_OPTIONS.map((targetStatus) => {
                            const isCurrent = prepStatus === targetStatus;
                            return (
                              <button
                                key={targetStatus}
                                type="button"
                                disabled={isCurrent || isItemBusy}
                                onClick={() =>
                                  onUpdateItemStatus(
                                    order.id,
                                    item.id,
                                    targetStatus
                                  )
                                }
                                className={cn(
                                  "rounded-lg border px-2 py-1 text-[11px] font-semibold transition",
                                  isCurrent
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : targetStatus === "Cancelled"
                                      ? "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                                  isItemBusy && "opacity-50"
                                )}
                              >
                                {getPrepStatusLabel(targetStatus)}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {(prepStatus === "Preparing" ||
                            prepStatus === "Ready") && (
                            <button
                              type="button"
                              disabled={isItemBusy}
                              onClick={() => onRevertItem(order.id, item.id)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              &#8630; Revert
                            </button>
                          )}

                          {(prepStatus === "Pending" ||
                            prepStatus === "Preparing") && (
                            <button
                              type="button"
                              disabled={isItemBusy}
                              onClick={() => onAdvanceItem(order.id, item.id)}
                              className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
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
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            {canCancelOrders &&
              (order.status === "Confirmed" ||
                order.status === "Preparing") && (
                <button
                  type="button"
                  disabled={isOrderBusy}
                  onClick={() => onRequestCancelOrder(order)}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  {order.status === "Preparing"
                    ? "Hủy đơn hàng (Tính Waste)"
                    : "Hủy đơn hàng"}
                </button>
              )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canUpdatePreparation && order.status === "Confirmed" && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => onStartPreparingOrder(order.id)}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-600 disabled:opacity-50"
              >
                {isOrderBusy ? "Đang xử lý..." : "Bắt đầu nấu cả đơn"}
              </button>
            )}

            {canUpdatePreparation && order.status === "Preparing" && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => onMarkOrderReady(order.id)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                {isOrderBusy ? "Đang xử lý..." : "Hoàn tất cả đơn (Ready)"}
              </button>
            )}

            {canUpdatePreparation && canRecallOrder(order) && (
              <button
                type="button"
                disabled={isOrderBusy}
                onClick={() => onRecallOrder(order)}
                className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
              >
                {isOrderBusy ? "Đang hoàn tác..." : "↺ Recall về bếp"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

