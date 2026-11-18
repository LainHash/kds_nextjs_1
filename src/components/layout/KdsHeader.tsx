"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useKdsSession } from "@/features/auth/context/KdsSessionProvider";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Bếp (Live)" },
  { href: "/history", label: "Lịch sử & Recall" },
  { href: "/branches", label: "Chi nhánh & Bàn" },
  { href: "/products", label: "Thực đơn & Kho" },
] as const;

export function KdsHeader() {
  const pathname = usePathname();
  const {
    user,
    activeBranch,
    tables,
    canUpdatePreparation,
    canSwitchBranch,
    logout,
  } = useKdsSession();
  const [clock, setClock] = useState<string>("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Date().toLocaleTimeString("vi-VN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-sm font-bold tracking-wider">KDS</span>
          </Link>

          <Link
            href="/branches"
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              activeBranch
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            )}
          >
            <span>
              {activeBranch
                ? `Chi nhánh: ${activeBranch.code} (${tables.length} bàn${
                    canSwitchBranch ? "" : " • Cố định"
                  })`
                : "Chưa chọn chi nhánh"}
            </span>
          </Link>

          {!canUpdatePreparation && (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
              Chỉ xem (thiếu quyền cập nhật món)
            </span>
          )}
        </div>

        <nav className="flex items-center gap-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {clock && (
            <span className="hidden font-mono text-sm font-semibold text-slate-700 sm:inline">
              {clock}
            </span>
          )}

          {user && (
            <div className="hidden text-right md:block">
              <p className="text-xs font-semibold text-slate-900">
                {user.userName}
              </p>
              <p className="text-[11px] text-slate-500">
                {user.organization?.positionName || user.role}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
          >
            {isLoggingOut ? "Đang thoát..." : "Đăng xuất"}
          </button>
        </div>
      </div>
    </header>
  );
}
