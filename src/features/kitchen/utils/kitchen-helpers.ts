import type { TableLookupEntry } from "@/features/territory/types";
import type {
  KitchenBoardStage,
  OrderDetailResponse,
  OrderItemResponse,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentTiming,
  PreparationStatus,
  SlaLevel,
  SlaThresholdConfig,
} from "../types";

export const DEFAULT_SLA_THRESHOLDS: SlaThresholdConfig = {
  warningMinutes: 7,
  criticalMinutes: 15,
};

export const LIVE_BOARD_ORDER_STATUSES: OrderStatus[] = [
  "Confirmed",
  "Preparing",
  "Served",
  "ReadyForPickup",
  "ReadyForDelivery",
];

export const HISTORY_ORDER_STATUSES: OrderStatus[] = [
  "Served",
  "ReadyForPickup",
  "ReadyForDelivery",
  "Delivering",
  "Completed",
  "Cancelled",
];

export function isOrderReadyStage(status: OrderStatus): boolean {
  return (
    status === "Served" ||
    status === "ReadyForPickup" ||
    status === "ReadyForDelivery"
  );
}

export function getOrderBoardStage(
  status: OrderStatus
): KitchenBoardStage | null {
  if (status === "Confirmed") return "Confirmed";
  if (status === "Preparing") return "Preparing";
  if (isOrderReadyStage(status)) return "Ready";
  return null;
}

export function canRecallOrder(order: OrderDetailResponse): boolean {
  if (!isOrderReadyStage(order.status)) return false;
  return order.orderItems.some((item) => {
    const prepStatus = getEffectivePrepStatus(item, order.status);
    return prepStatus === "Ready" || prepStatus === "Preparing";
  });
}

export function getEffectivePrepStatus(
  item: OrderItemResponse,
  orderStatus?: OrderStatus
): PreparationStatus {
  if (item.preparationStatus) {
    return item.preparationStatus;
  }
  if (orderStatus === "Cancelled") return "Cancelled";
  if (
    orderStatus &&
    (isOrderReadyStage(orderStatus) ||
      orderStatus === "Delivering" ||
      orderStatus === "Completed")
  ) {
    return "Ready";
  }
  if (orderStatus === "Preparing") return "Preparing";
  return "Pending";
}

export function getOrderTypeLabel(type: OrderType): string {
  switch (type) {
    case "DineIn":
      return "Ăn tại bàn";
    case "TakeAway":
      return "Mang về";
    case "Delivery":
      return "Giao hàng";
    default:
      return type;
  }
}

export function getOrderTypeBadgeClass(type: OrderType): string {
  switch (type) {
    case "DineIn":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "TakeAway":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "Delivery":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "Draft":
      return "Đơn nháp";
    case "Pending":
      return "Chờ xác nhận";
    case "Confirmed":
      return "Chờ chế biến";
    case "Preparing":
      return "Đang chế biến";
    case "Served":
      return "Đã ra món (Bàn)";
    case "ReadyForPickup":
      return "Chờ khách lấy";
    case "ReadyForDelivery":
      return "Chờ tài xế nhận";
    case "Delivering":
      return "Đang giao hàng";
    case "Completed":
      return "Hoàn tất";
    case "Cancelled":
      return "Đã hủy";
    default:
      return status;
  }
}

export function getOrderStatusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "Confirmed":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Preparing":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "Served":
    case "ReadyForPickup":
    case "ReadyForDelivery":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Delivering":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "Completed":
      return "border-slate-300 bg-slate-100 text-slate-800";
    case "Cancelled":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function getPrepStatusLabel(status: PreparationStatus): string {
  switch (status) {
    case "Pending":
      return "Chờ nấu";
    case "Preparing":
      return "Đang nấu";
    case "Ready":
      return "Đã xong";
    case "Cancelled":
      return "Đã hủy";
    default:
      return status;
  }
}

export function getPrepStatusBadgeClass(status: PreparationStatus): string {
  switch (status) {
    case "Pending":
      return "border-slate-300 bg-slate-100 text-slate-700";
    case "Preparing":
      return "border-amber-300 bg-amber-100 text-amber-900";
    case "Ready":
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    case "Cancelled":
      return "border-rose-200 bg-rose-50 text-rose-700 line-through";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function getPaymentStatusLabel(
  status: PaymentStatus,
  timing?: PaymentTiming
): string {
  const timingPrefix =
    timing === "Prepay" ? "Trả trước" : timing === "Postpay" ? "Trả sau" : "";
  switch (status) {
    case "Paid":
      return timingPrefix ? `${timingPrefix} • Đã TT` : "Đã thanh toán";
    case "Unpaid":
      return timingPrefix ? `${timingPrefix} • Chưa TT` : "Chưa thanh toán";
    case "Refund":
      return "Hoàn tiền";
    default:
      return status;
  }
}

export function getPaymentStatusBadgeClass(status: PaymentStatus): string {
  switch (status) {
    case "Paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Unpaid":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "Refund":
      return "border-purple-200 bg-purple-50 text-purple-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function resolveTableDisplay(
  restaurantTableId: string | null | undefined,
  tableMap: Record<string, TableLookupEntry>
): { tableLabel: string; areaLabel: string | null } | null {
  if (!restaurantTableId) return null;
  const entry = tableMap[restaurantTableId];
  if (entry) {
    return {
      tableLabel: `Bàn ${entry.tableNumber}`,
      areaLabel: entry.areaName ?? null,
    };
  }
  return {
    tableLabel: `Bàn #${restaurantTableId.slice(0, 6)}`,
    areaLabel: null,
  };
}

export interface SlaMetrics {
  elapsedSeconds: number;
  elapsedMinutes: number;
  formattedTimer: string;
  level: SlaLevel;
}

export function calculateSlaMetrics(
  order: Pick<OrderDetailResponse, "createdAt" | "status">,
  nowMs: number,
  thresholds: SlaThresholdConfig = DEFAULT_SLA_THRESHOLDS
): SlaMetrics {
  const createdMs = new Date(order.createdAt).getTime();
  const rawDiffSeconds = Number.isFinite(createdMs)
    ? Math.max(0, Math.floor((nowMs - createdMs) / 1000))
    : 0;
  const elapsedMinutes = Math.floor(rawDiffSeconds / 60);
  const seconds = rawDiffSeconds % 60;
  const hours = Math.floor(elapsedMinutes / 60);
  const minsInHour = elapsedMinutes % 60;

  const formattedTimer =
    hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minsInHour).padStart(
          2,
          "0"
        )}:${String(seconds).padStart(2, "0")}`
      : `${String(elapsedMinutes).padStart(2, "0")}:${String(seconds).padStart(
          2,
          "0"
        )}`;

  if (isOrderReadyStage(order.status) || order.status === "Completed" || order.status === "Cancelled") {
    return {
      elapsedSeconds: rawDiffSeconds,
      elapsedMinutes,
      formattedTimer,
      level: "normal",
    };
  }

  let level: SlaLevel = "normal";
  if (elapsedMinutes >= thresholds.criticalMinutes) {
    level = "critical";
  } else if (elapsedMinutes >= thresholds.warningMinutes) {
    level = "warning";
  }

  return {
    elapsedSeconds: rawDiffSeconds,
    elapsedMinutes,
    formattedTimer,
    level,
  };
}

export function getSlaBadgeClass(level: SlaLevel): string {
  switch (level) {
    case "critical":
      return "border-rose-300 bg-rose-600 text-white animate-pulse";
    case "warning":
      return "border-amber-300 bg-amber-500 text-white";
    case "normal":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
}

export function getSlaCardBorderClass(
  level: SlaLevel,
  status: OrderStatus
): string {
  if (isOrderReadyStage(status)) {
    return "border-emerald-300 bg-emerald-50/20";
  }
  switch (level) {
    case "critical":
      return "border-rose-400 ring-2 ring-rose-500/20 bg-white";
    case "warning":
      return "border-amber-400 ring-1 ring-amber-400/30 bg-white";
    case "normal":
    default:
      return "border-slate-200 bg-white";
  }
}

export function formatCurrencyVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatTimeShort(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("vi-VN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDateTimeVi(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatPrepDuration(
  startedAt?: string | null,
  completedAt?: string | null
): string | null {
  if (!startedAt) return null;
  const startMs = new Date(startedAt).getTime();
  const endMs = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  const diffSec = Math.floor((endMs - startMs) / 1000);
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}p ${String(secs).padStart(2, "0")}s`;
}

export function playNewOrderChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + startOffset);

      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.2, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + startOffset + duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    playTone(587.33, 0, 0.16); // D5
    playTone(880, 0.16, 0.28); // A5

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

