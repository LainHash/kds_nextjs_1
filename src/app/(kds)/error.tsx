"use client";

export default function KdsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 space-y-3">
      <h2 className="text-lg font-semibold">Đã xảy ra lỗi</h2>
      <p className="text-sm opacity-80">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="px-3 py-1.5 text-sm rounded border"
      >
        Thử lại
      </button>
    </div>
  );
}

