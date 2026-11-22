"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useKdsSession } from "@/features/auth/context/KdsSessionProvider";
import { getBranches } from "@/features/territory/services/territory.service";
import type { BranchResponse } from "@/features/territory/types";
import { ApiError } from "@/lib/api-client";
import {
  getBranchStatusLabel,
  getTableShapeLabel,
  getTableStatusLabel,
} from "@/lib/enum-labels";
import { cn } from "@/lib/utils";

function getTableStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "occupied":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "reserved":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export default function BranchesPage() {
  const {
    activeBranch,
    assignedBranchId,
    canSwitchBranch,
    isGlobalScope,
    areas,
    tables,
    isBranchMetadataLoading,
    setActiveBranch,
    refreshBranchMetadata,
  } = useKdsSession();

  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>("ALL");

  const loadBranches = async () => {
    try {
      const res = await getBranches({ page: 1, pageSize: 50 });
      setBranches(res.data ?? []);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Không thể tải danh sách chi nhánh."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const res = await getBranches({ page: 1, pageSize: 50 });
        if (!cancelled) {
          setBranches(res.data ?? []);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : "Không thể tải danh sách chi nhánh."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleReloadBranches = () => {
    setIsLoading(true);
    setErrorMessage(null);
    void loadBranches();
  };

  const filteredTables = useMemo(() => {
    if (selectedAreaFilter === "ALL") return tables;
    return tables.filter((table) => table.areaName === selectedAreaFilter);
  }, [tables, selectedAreaFilter]);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Chi nhánh &amp; Sơ đồ Bàn
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {canSwitchBranch
              ? "Chọn chi nhánh bếp đang vận hành để đồng bộ danh sách bàn Dine-In và hàng đợi đơn hàng."
              : "Tài khoản phạm vi chi nhánh đang cố định theo chi nhánh được phân công."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReloadBranches}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-100"
          >
            Tải lại chi nhánh
          </button>
          {activeBranch && (
            <Link
              href="/"
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-600"
            >
              Mở màn hình Bếp &rarr;
            </Link>
          )}
        </div>
      </section>

      {!canSwitchBranch && assignedBranchId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tài khoản của bạn thuộc phạm vi{" "}
          <span className="font-semibold">Branch</span> và đã được chỉ định cố
          định tại chi nhánh{" "}
          <span className="font-mono font-semibold">
            {activeBranch?.code ?? assignedBranchId}
          </span>
          . Bạn không thể chuyển sang thao tác ở chi nhánh khác.
        </div>
      )}

      {isGlobalScope && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Tài khoản thuộc phạm vi <span className="font-semibold">Global</span>{" "}
          — có thể tự do chuyển đổi giữa các chi nhánh.
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Danh sách chi nhánh ({branches.length})
        </h2>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Chưa có dữ liệu chi nhánh.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => {
              const isSelected = activeBranch?.id === branch.id;
              const isAssigned = assignedBranchId === branch.id;
              const isLockedOut = !canSwitchBranch && !isAssigned;

              return (
                <div
                  key={branch.id}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition",
                    isSelected
                      ? "border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200"
                      : isLockedOut
                        ? "border-slate-200 bg-slate-100/80 opacity-65"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-base font-bold text-slate-900">
                        {branch.code}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                          branch.status.toLowerCase() === "active" ||
                            branch.status.toLowerCase() === "open"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        )}
                      >
                        {getBranchStatusLabel(branch.status)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-700">
                      {branch.fullAddress ||
                        `${branch.streetAddress}, ${branch.wardName}, ${branch.provinceName}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      Giờ hoạt động: {branch.openTime} &ndash;{" "}
                      {branch.closeTime}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isLockedOut}
                    onClick={() => {
                      if (isLockedOut) return;
                      setSelectedAreaFilter("ALL");
                      setActiveBranch(branch);
                    }}
                    className={cn(
                      "mt-4 w-full rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                      isSelected
                        ? "bg-emerald-600 text-white"
                        : isLockedOut
                          ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                          : "border border-slate-300 bg-slate-50 text-slate-800 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800"
                    )}
                  >
                    {isSelected
                      ? canSwitchBranch
                        ? "Đang chọn chi nhánh này"
                        : "Chi nhánh được phân công (Cố định)"
                      : isLockedOut
                        ? "Không thuộc phạm vi tài khoản"
                        : "Chọn chi nhánh"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {activeBranch && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Khu vực &amp; Bàn của chi nhánh {activeBranch.code}
              </h2>
              <p className="text-xs text-slate-500">
                {areas.length} khu vực &bull; {tables.length} bàn (dùng để ánh xạ
                tên bàn trên ticket Dine-In)
              </p>
            </div>

            <button
              type="button"
              onClick={() => void refreshBranchMetadata(activeBranch.id)}
              disabled={isBranchMetadataLoading}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {isBranchMetadataLoading ? "Đang đồng bộ..." : "Đồng bộ bàn"}
            </button>
          </div>

          {areas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedAreaFilter("ALL")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  selectedAreaFilter === "ALL"
                    ? "bg-amber-500 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                )}
              >
                Tất cả ({tables.length})
              </button>
              {areas.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setSelectedAreaFilter(area.name)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    selectedAreaFilter === area.name
                      ? "bg-amber-500 text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {area.name} ({area.tableCount})
                </button>
              ))}
            </div>
          )}

          {isBranchMetadataLoading ? (
            <p className="text-sm text-slate-500">Đang tải danh sách bàn...</p>
          ) : filteredTables.length === 0 ? (
            <p className="text-sm text-slate-500">
              Không có bàn nào trong khu vực đã chọn.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {filteredTables.map((table) => (
                <div
                  key={table.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {table.tableNumber}
                    </span>
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                        getTableStatusBadgeClass(table.status)
                      )}
                    >
                      {getTableStatusLabel(table.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-600">
                    {table.areaName || "Khu chung"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {table.capacity} chỗ &bull; {getTableShapeLabel(table.shape)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
