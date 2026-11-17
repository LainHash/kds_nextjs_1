"use client";

import Link from "next/link";
import { useKdsSession } from "@/features/auth/context/KdsSessionProvider";
import { KDS_REQUIRED_PERMISSIONS } from "@/lib/constants";
import { env } from "@/lib/env";

export default function KdsHomePage() {
  const {
    user,
    activeBranch,
    areas,
    tables,
    canUpdatePreparation,
    canSwitchBranch,
    isBranchMetadataLoading,
  } = useKdsSession();

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bảng điều phối bếp (KDS Live Board)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            API Gateway:{" "}
            <code className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200">
              {env.apiBaseUrl || "Chưa cấu hình"}
            </code>
          </p>
        </div>

        {!activeBranch ? (
          <Link
            href="/branches"
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-amber-600"
          >
            Chọn chi nhánh làm việc
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700">
              Đang trực chi nhánh {activeBranch.code}
            </span>
            <Link
              href="/branches"
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {canSwitchBranch ? "Đổi chi nhánh" : "Xem sơ đồ bàn"}
            </Link>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs text-slate-500">Tài khoản đang trực</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {user?.userName ?? "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {user?.organization?.positionName || user?.role || "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs text-slate-500">Quyền thao tác bếp</p>
          <p
            className={`mt-1 text-base font-semibold ${
              canUpdatePreparation ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {canUpdatePreparation ? "Đầy đủ quyền" : "Chỉ xem"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {KDS_REQUIRED_PERMISSIONS.updatePreparation}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs text-slate-500">Chi nhánh đang chọn</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {activeBranch ? activeBranch.code : "Chưa chọn"}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-600">
            {activeBranch?.fullAddress || "Vào Chi nhánh & Bàn để chọn"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs text-slate-500">Dữ liệu khu vực &amp; bàn</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {isBranchMetadataLoading
              ? "Đang đồng bộ..."
              : `${areas.length} khu vực / ${tables.length} bàn`}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Sẵn sàng ánh xạ cho đơn Dine-In
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">
          Nền tảng Giai đoạn 1 đã sẵn sàng
        </p>
        <p className="mt-1 text-slate-600">
          Các luồng đăng nhập, tự động làm mới token, kiểm tra quyền bếp và đồng
          bộ chi nhánh/bàn đã hoàn thiện. Bước tiếp theo (Giai đoạn 2) sẽ dựng
          hàng đợi ticket đơn hàng từ{" "}
          <code className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200">
            GET /api/commerce/orders/kitchen-queue
          </code>{" "}
          và thao tác Advance/Revert từng món.
        </p>
      </section>
    </div>
  );
}
