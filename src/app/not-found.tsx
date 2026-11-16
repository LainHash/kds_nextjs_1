import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold">404 - Không tìm thấy trang</h1>
      <Link href="/" className="text-sm underline">
        Quay về màn hình bếp
      </Link>
    </main>
  );
}

