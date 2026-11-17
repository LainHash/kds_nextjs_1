"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { KdsHeader } from "@/components/layout/KdsHeader";
import { useKdsSession } from "@/features/auth/context/KdsSessionProvider";

export default function KdsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { isReady, isAuthenticated } = useKdsSession();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      const target =
        pathname && pathname !== "/"
          ? `/login?next=${encodeURIComponent(pathname)}`
          : "/login";
      router.replace(target);
    }
  }, [isReady, isAuthenticated, pathname, router]);

  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
          <span>Đang kiểm tra phiên đăng nhập KDS...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <KdsHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
