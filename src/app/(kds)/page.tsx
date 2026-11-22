"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useKdsSession } from "@/features/auth/context/KdsSessionProvider";
import { OrderTicketCard } from "@/features/kitchen/components/OrderTicketCard";

const CancelOrderModal = dynamic(
  () =>
    import("@/features/kitchen/components/CancelOrderModal").then(
      (m) => m.CancelOrderModal
    ),
  { ssr: false }
);

const OrderDetailDrawer = dynamic(
  () =>
    import("@/features/kitchen/components/OrderDetailDrawer").then(
      (m) => m.OrderDetailDrawer
    ),
  { ssr: false }
);
import { useKitchenQueue } from "@/features/kitchen/hooks/useKitchenQueue";
import type {
  KdsBoardViewMode,
  KitchenStageFilter,
  OrderDetailResponse,
  OrderTypeFilter,
} from "@/features/kitchen/types";
import {
  calculateSlaMetrics,
  DEFAULT_SLA_THRESHOLDS,
  formatTimeShort,
  getOrderBoardStage,
  resolveTableDisplay,
} from "@/features/kitchen/utils/kitchen-helpers";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_OPTIONS = [
  { label: "5 giây", value: 5000 },
  { label: "10 giây", value: 10000 },
  { label: "15 giây", value: 15000 },
] as const;

export default function KdsHomePage() {
  const {
    activeBranch,
    tableMap,
    canUpdatePreparation,
    canCancelOrders,
    canSwitchBranch,
  } = useKdsSession();

  const [viewMode, setViewMode] = useState<KdsBoardViewMode>("kanban");
  const [stageFilter, setStageFilter] = useState<KitchenStageFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(5000);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] =
    useState<OrderDetailResponse | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const {
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
  } = useKitchenQueue({
    branchId: activeBranch?.id,
    pollIntervalMs,
    soundEnabled,
    enabled: Boolean(activeBranch?.id),
  });

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      dismissFeedback();
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [feedback, dismissFeedback]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  // Filter by OrderType & Search Keyword first so column counts reflect type/search filters
  const baseFilteredOrders = useMemo(() => {
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      if (typeFilter !== "ALL" && order.type !== typeFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const tableInfo = resolveTableDisplay(order.restaurantTableId, tableMap);
      const matchesCode = order.orderCode
        .toLowerCase()
        .includes(normalizedSearch);
      const matchesNote = (order.note ?? "")
        .toLowerCase()
        .includes(normalizedSearch);
      const matchesTable = (tableInfo?.tableLabel ?? "")
        .toLowerCase()
        .includes(normalizedSearch);
      const matchesItem = order.orderItems.some(
        (item) =>
          item.productName.toLowerCase().includes(normalizedSearch) ||
          (item.note ?? "").toLowerCase().includes(normalizedSearch)
      );

      return matchesCode || matchesNote || matchesTable || matchesItem;
    });
  }, [orders, typeFilter, deferredSearchQuery, tableMap]);

  const confirmedOrders = useMemo(
    () =>
      baseFilteredOrders.filter(
        (o) => getOrderBoardStage(o.status) === "Confirmed"
      ),
    [baseFilteredOrders]
  );

  const preparingOrders = useMemo(
    () =>
      baseFilteredOrders.filter(
        (o) => getOrderBoardStage(o.status) === "Preparing"
      ),
    [baseFilteredOrders]
  );

  const readyOrders = useMemo(
    () =>
      baseFilteredOrders.filter(
        (o) => getOrderBoardStage(o.status) === "Ready"
      ),
    [baseFilteredOrders]
  );

  const visibleOrders = useMemo(() => {
    if (stageFilter === "Confirmed") return confirmedOrders;
    if (stageFilter === "Preparing") return preparingOrders;
    if (stageFilter === "Ready") return readyOrders;
    return baseFilteredOrders;
  }, [
    stageFilter,
    confirmedOrders,
    preparingOrders,
    readyOrders,
    baseFilteredOrders,
  ]);

  const slaCounts = useMemo(() => {
    let warning = 0;
    let critical = 0;
    for (const order of baseFilteredOrders) {
      if (order.status !== "Confirmed" && order.status !== "Preparing") continue;
      const metrics = calculateSlaMetrics(
        order,
        nowMs,
        DEFAULT_SLA_THRESHOLDS
      );
      if (metrics.level === "critical") critical += 1;
      else if (metrics.level === "warning") warning += 1;
    }
    return { warning, critical };
  }, [baseFilteredOrders, nowMs]);

  if (!activeBranch) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
          <span className="font-bold">KDS</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          Chưa chọn chi nhánh làm việc
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
          Vui lòng chọn chi nhánh bếp đang trực để kết nối hàng đợi đơn hàng và
          sơ đồ bàn ăn tại chi nhánh đó.
        </p>
        <Link
          href="/branches"
          className="mt-5 inline-flex items-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-amber-600"
        >
          Chọn chi nhánh ngay &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Control Header */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                Bảng Điều Phối Bếp (Live Board)
              </h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  connectionState === "reconnecting"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : connectionState === "syncing" || isRefreshing
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    connectionState === "reconnecting"
                      ? "animate-ping bg-rose-500"
                      : connectionState === "syncing" || isRefreshing
                        ? "animate-pulse bg-amber-500"
                        : "bg-emerald-500"
                  )}
                />
                <span>
                  {connectionState === "reconnecting"
                    ? "Đang kết nối lại..."
                    : isRefreshing
                      ? "Đang đồng bộ..."
                      : "Online"}
                </span>
              </span>
            </div>

            <p className="mt-0.5 text-xs text-slate-500">
              Chi nhánh:{" "}
              <span className="font-semibold text-slate-800">
                {activeBranch.code}
              </span>{" "}
              &bull; Đồng bộ lần cuối:{" "}
              <span className="font-mono font-medium text-slate-700">
                {lastSyncedAt
                  ? formatTimeShort(lastSyncedAt.toISOString())
                  : "—"}
              </span>{" "}
              &bull; SLA: Vàng &ge; {DEFAULT_SLA_THRESHOLDS.warningMinutes}p, Đỏ
              &ge; {DEFAULT_SLA_THRESHOLDS.criticalMinutes}p
            </p>
          </div>
        </div>

        {/* Right Controls: Sound, Poll Interval, View Mode, Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
              soundEnabled
                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
            title="Bật/tắt âm thanh chuông báo khi có đơn Confirmed mới vào bếp"
          >
            {soundEnabled ? "🔔 Chuông: Bật" : "🔕 Chuông: Tắt"}
          </button>

          <select
            aria-label="Chu kỳ làm mới tự động"
            value={pollIntervalMs}
            onChange={(e) => setPollIntervalMs(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
          >
            {POLL_INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Polling: {opt.label}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                viewMode === "kanban"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Kanban 3 cột
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Ticket Grid
            </button>
          </div>

          <button
            type="button"
            onClick={() => void refreshNow()}
            disabled={isRefreshing}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {isRefreshing ? "Đang tải..." : "↻ Làm mới"}
          </button>

          {canSwitchBranch && (
            <Link
              href="/branches"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Đổi chi nhánh
            </Link>
          )}
        </div>
      </section>

      {/* Quick KPI Summary Bar */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() =>
            setStageFilter((prev) =>
              prev === "Confirmed" ? "ALL" : "Confirmed"
            )
          }
          className={cn(
            "flex items-center justify-between rounded-2xl border p-4 text-left transition",
            stageFilter === "Confirmed"
              ? "border-sky-400 bg-sky-50/80 ring-2 ring-sky-500/20"
              : "border-slate-200 bg-white hover:border-sky-300"
          )}
        >
          <div>
            <p className="text-xs font-medium text-slate-500">
              Chờ chế biến (Confirmed)
            </p>
            <p className="mt-1 text-2xl font-extrabold text-sky-700">
              {confirmedOrders.length}
            </p>
          </div>
          <span className="rounded-xl bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">
            Mới vào
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setStageFilter((prev) =>
              prev === "Preparing" ? "ALL" : "Preparing"
            )
          }
          className={cn(
            "flex items-center justify-between rounded-2xl border p-4 text-left transition",
            stageFilter === "Preparing"
              ? "border-amber-400 bg-amber-50/80 ring-2 ring-amber-500/20"
              : "border-slate-200 bg-white hover:border-amber-300"
          )}
        >
          <div>
            <p className="text-xs font-medium text-slate-500">
              Đang chế biến (Preparing)
            </p>
            <p className="mt-1 text-2xl font-extrabold text-amber-700">
              {preparingOrders.length}
            </p>
          </div>
          <span className="rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            Đang nấu
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setStageFilter((prev) => (prev === "Ready" ? "ALL" : "Ready"))
          }
          className={cn(
            "flex items-center justify-between rounded-2xl border p-4 text-left transition",
            stageFilter === "Ready"
              ? "border-emerald-400 bg-emerald-50/80 ring-2 ring-emerald-500/20"
              : "border-slate-200 bg-white hover:border-emerald-300"
          )}
        >
          <div>
            <p className="text-xs font-medium text-slate-500">
              Vừa xong / Chờ phục vụ
            </p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-700">
              {readyOrders.length}
            </p>
          </div>
          <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
            Ready
          </span>
        </button>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Cảnh báo thời gian SLA
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-2xl font-extrabold text-rose-600">
                {slaCounts.critical} đỏ
              </span>
              <span className="text-sm font-bold text-amber-600">
                {slaCounts.warning} vàng
              </span>
            </div>
          </div>
          <Link
            href="/history"
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Lịch sử &rarr;
          </Link>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Stage Filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                { value: "ALL", label: `Tất cả (${baseFilteredOrders.length})` },
                {
                  value: "Confirmed",
                  label: `Chờ nấu (${confirmedOrders.length})`,
                },
                {
                  value: "Preparing",
                  label: `Đang nấu (${preparingOrders.length})`,
                },
                {
                  value: "Ready",
                  label: `Vừa xong (${readyOrders.length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStageFilter(tab.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                  stageFilter === tab.value
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* OrderType Filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {(
              [
                { value: "ALL", label: "Mọi loại đơn" },
                { value: "DineIn", label: "Ăn tại bàn" },
                { value: "TakeAway", label: "Mang về" },
                { value: "Delivery", label: "Giao hàng" },
              ] as const
            ).map((typeTab) => (
              <button
                key={typeTab.value}
                type="button"
                onClick={() => setTypeFilter(typeTab.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  typeFilter === typeTab.value
                    ? "bg-amber-500 font-semibold text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {typeTab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã đơn, số bàn, tên món, ghi chú..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </section>

      {/* Action Feedback & Error Alerts */}
      {feedback && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-xs",
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          )}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={dismissFeedback}
            className="rounded px-2 py-0.5 text-[11px] font-semibold hover:bg-black/5"
          >
            Đóng
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => void refreshNow()}
            className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100"
          >
            Thử kết nối lại
          </button>
        </div>
      )}

      {/* Main Board Content */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((col) => (
            <div
              key={col}
              className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
            />
          ))}
        </div>
      ) : viewMode === "kanban" && stageFilter === "ALL" ? (
        <section className="grid gap-5 lg:grid-cols-3">
          {/* Column 1: Confirmed */}
          <div className="flex flex-col rounded-2xl border border-sky-200/80 bg-sky-50/30 p-3.5">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                <h2 className="text-sm font-bold text-slate-900">
                  Chờ chế biến (Confirmed)
                </h2>
              </div>
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 font-mono text-xs font-bold text-sky-800">
                {confirmedOrders.length}
              </span>
            </div>

            {confirmedOrders.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-xs text-slate-500">
                Không có đơn hàng nào đang chờ nhận nấu.
              </div>
            ) : (
              <div className="space-y-3.5">
                {confirmedOrders.map((order) => (
                  <OrderTicketCard
                    key={order.id}
                    order={order}
                    nowMs={nowMs}
                    tableMap={tableMap}
                    canUpdatePreparation={canUpdatePreparation}
                    canCancelOrders={canCancelOrders}
                    isOrderBusy={Boolean(busyOrderIds[order.id])}
                    busyItemIds={busyItemIds}
                    onOpenDetail={(o) => setSelectedOrderId(o.id)}
                    onStartPreparingOrder={(id) =>
                      void handleStartPreparingOrder(id)
                    }
                    onMarkOrderReady={(id) => void handleMarkOrderReady(id)}
                    onRequestCancelOrder={(o) => setCancellingOrder(o)}
                    onRecallOrder={(o) => void handleRecallOrder(o)}
                    onAdvanceItem={(orderId, itemId) =>
                      void handleAdvanceItem(orderId, itemId)
                    }
                    onRevertItem={(orderId, itemId) =>
                      void handleRevertItem(orderId, itemId)
                    }
                    onUpdateItemStatus={(orderId, itemId, status) =>
                      void handleUpdateItemStatus(orderId, itemId, status)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Preparing */}
          <div className="flex flex-col rounded-2xl border border-amber-200/90 bg-amber-50/30 p-3.5">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <h2 className="text-sm font-bold text-slate-900">
                  Đang chế biến (Preparing)
                </h2>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-900">
                {preparingOrders.length}
              </span>
            </div>

            {preparingOrders.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-xs text-slate-500">
                Chưa có đơn hàng nào đang trên bếp.
              </div>
            ) : (
              <div className="space-y-3.5">
                {preparingOrders.map((order) => (
                  <OrderTicketCard
                    key={order.id}
                    order={order}
                    nowMs={nowMs}
                    tableMap={tableMap}
                    canUpdatePreparation={canUpdatePreparation}
                    canCancelOrders={canCancelOrders}
                    isOrderBusy={Boolean(busyOrderIds[order.id])}
                    busyItemIds={busyItemIds}
                    onOpenDetail={(o) => setSelectedOrderId(o.id)}
                    onStartPreparingOrder={(id) =>
                      void handleStartPreparingOrder(id)
                    }
                    onMarkOrderReady={(id) => void handleMarkOrderReady(id)}
                    onRequestCancelOrder={(o) => setCancellingOrder(o)}
                    onRecallOrder={(o) => void handleRecallOrder(o)}
                    onAdvanceItem={(orderId, itemId) =>
                      void handleAdvanceItem(orderId, itemId)
                    }
                    onRevertItem={(orderId, itemId) =>
                      void handleRevertItem(orderId, itemId)
                    }
                    onUpdateItemStatus={(orderId, itemId, status) =>
                      void handleUpdateItemStatus(orderId, itemId, status)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Column 3: Ready (Served / ReadyForPickup / ReadyForDelivery) */}
          <div className="flex flex-col rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-3.5">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h2 className="text-sm font-bold text-slate-900">
                  Vừa xong / Chờ phục vụ (Ready)
                </h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800">
                {readyOrders.length}
              </span>
            </div>

            {readyOrders.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-xs text-slate-500">
                Chưa có đơn vừa hoàn tất.
              </div>
            ) : (
              <div className="space-y-3.5">
                {readyOrders.map((order) => (
                  <OrderTicketCard
                    key={order.id}
                    order={order}
                    nowMs={nowMs}
                    tableMap={tableMap}
                    canUpdatePreparation={canUpdatePreparation}
                    canCancelOrders={canCancelOrders}
                    isOrderBusy={Boolean(busyOrderIds[order.id])}
                    busyItemIds={busyItemIds}
                    onOpenDetail={(o) => setSelectedOrderId(o.id)}
                    onStartPreparingOrder={(id) =>
                      void handleStartPreparingOrder(id)
                    }
                    onMarkOrderReady={(id) => void handleMarkOrderReady(id)}
                    onRequestCancelOrder={(o) => setCancellingOrder(o)}
                    onRecallOrder={(o) => void handleRecallOrder(o)}
                    onAdvanceItem={(orderId, itemId) =>
                      void handleAdvanceItem(orderId, itemId)
                    }
                    onRevertItem={(orderId, itemId) =>
                      void handleRevertItem(orderId, itemId)
                    }
                    onUpdateItemStatus={(orderId, itemId, status) =>
                      void handleUpdateItemStatus(orderId, itemId, status)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base font-bold text-slate-800">
            Không có đơn hàng nào khớp bộ lọc hiện tại
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Hệ thống vẫn đang tự động đồng bộ hàng đợi bếp mỗi{" "}
            {pollIntervalMs / 1000} giây.
          </p>
          {(stageFilter !== "ALL" ||
            typeFilter !== "ALL" ||
            searchQuery.trim() !== "") && (
            <button
              type="button"
              onClick={() => {
                setStageFilter("ALL");
                setTypeFilter("ALL");
                setSearchQuery("");
              }}
              className="mt-4 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleOrders.map((order) => (
            <OrderTicketCard
              key={order.id}
              order={order}
              nowMs={nowMs}
              tableMap={tableMap}
              canUpdatePreparation={canUpdatePreparation}
              canCancelOrders={canCancelOrders}
              isOrderBusy={Boolean(busyOrderIds[order.id])}
              busyItemIds={busyItemIds}
              onOpenDetail={(o) => setSelectedOrderId(o.id)}
              onStartPreparingOrder={(id) =>
                void handleStartPreparingOrder(id)
              }
              onMarkOrderReady={(id) => void handleMarkOrderReady(id)}
              onRequestCancelOrder={(o) => setCancellingOrder(o)}
              onRecallOrder={(o) => void handleRecallOrder(o)}
              onAdvanceItem={(orderId, itemId) =>
                void handleAdvanceItem(orderId, itemId)
              }
              onRevertItem={(orderId, itemId) =>
                void handleRevertItem(orderId, itemId)
              }
              onUpdateItemStatus={(orderId, itemId, status) =>
                void handleUpdateItemStatus(orderId, itemId, status)
              }
            />
          ))}
        </section>
      )}

      {/* Slide-over Order Detail Drawer */}
      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          tableMap={tableMap}
          canUpdatePreparation={canUpdatePreparation}
          canCancelOrders={canCancelOrders}
          isOrderBusy={Boolean(busyOrderIds[selectedOrder.id])}
          busyItemIds={busyItemIds}
          onClose={() => setSelectedOrderId(null)}
          onStartPreparingOrder={(id) => void handleStartPreparingOrder(id)}
          onMarkOrderReady={(id) => void handleMarkOrderReady(id)}
          onRequestCancelOrder={(o) => setCancellingOrder(o)}
          onRecallOrder={(o) => void handleRecallOrder(o)}
          onAdvanceItem={(orderId, itemId) =>
            void handleAdvanceItem(orderId, itemId)
          }
          onRevertItem={(orderId, itemId) =>
            void handleRevertItem(orderId, itemId)
          }
          onUpdateItemStatus={(orderId, itemId, status) =>
            void handleUpdateItemStatus(orderId, itemId, status)
          }
        />
      )}

      {/* Cancel Order Modal with Waste Warning */}
      {cancellingOrder && (
        <CancelOrderModal
          order={cancellingOrder}
          isBusy={Boolean(busyOrderIds[cancellingOrder.id])}
          onClose={() => setCancellingOrder(null)}
          onConfirmCancel={handleCancelOrder}
        />
      )}
    </div>
  );
}
