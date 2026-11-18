"use client";

import { useState, type FormEvent } from "react";
import type { OrderDetailResponse } from "../types";
import {
  formatCurrencyVnd,
  getOrderStatusLabel,
  getOrderTypeLabel,
} from "../utils/kitchen-helpers";

const PRESET_REASONS = [
  "Khách hàng yêu cầu hủy đơn",
  "Bếp hết nguyên liệu đột xuất",
  "Nhân viên thu ngân/phục vụ tạo nhầm đơn",
  "Sự cố chế biến tại bếp (làm hỏng món)",
] as const;

interface CancelOrderModalProps {
  order: OrderDetailResponse | null;
  isBusy?: boolean;
  onClose: () => void;
  onConfirmCancel: (orderId: string, reason: string) => Promise<boolean>;
}

export function CancelOrderModal({
  order,
  isBusy = false,
  onClose,
  onConfirmCancel,
}: CancelOrderModalProps) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!order) return null;

  const isPreparingOrFurther =
    order.status === "Preparing" ||
    order.orderItems.some(
      (item) =>
        item.preparationStatus === "Preparing" ||
        item.preparationStatus === "Ready"
    );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError("Vui lòng nhập hoặc chọn lý do hủy đơn hàng.");
      return;
    }

    setValidationError(null);
    const ok = await onConfirmCancel(order.id, trimmed);
    if (ok) {
      setReason("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-modal-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="cancel-order-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              Xác nhận hủy đơn hàng #{order.orderCode}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {getOrderTypeLabel(order.type)} &bull; Trạng thái hiện tại:{" "}
              <span className="font-semibold text-slate-800">
                {getOrderStatusLabel(order.status)}
              </span>{" "}
              &bull; Tổng tiền:{" "}
              <span className="font-semibold text-slate-800">
                {formatCurrencyVnd(order.totalAmount)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Đóng
          </button>
        </div>

        {isPreparingOrFurther ? (
          <div className="mt-4 rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-xs text-rose-900">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600" />
              <span>
                CẢNH BÁO HAO HỤT NGUYÊN LIỆU (WASTE — KHÔNG HOÀN KHO)
              </span>
            </div>
            <p className="mt-1.5 leading-relaxed">
              Đơn hàng này đang ở giai đoạn{" "}
              <span className="font-semibold underline">Đang chế biến</span>{" "}
              (kho nguyên liệu tại <code className="font-mono">TerritoryService</code>{" "}
              đã thực hiện <span className="font-semibold">Deduct</span>). Nếu
              hủy đơn lúc này, hệ thống{" "}
              <span className="font-bold">KHÔNG hoàn trả nguyên liệu về kho</span>{" "}
              mà ghi nhận toàn bộ phần nguyên liệu đã xuất là{" "}
              <span className="font-bold">Hao hụt (Waste)</span>.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-xs text-sky-900">
            <p className="font-semibold text-sky-800">
              Giải phóng tồn kho giữ tạm (Release Inventory)
            </p>
            <p className="mt-1 leading-relaxed">
              Đơn hàng đang ở trạng thái{" "}
              <span className="font-semibold">Chờ chế biến (Confirmed)</span>,
              bếp chưa bắt đầu nấu. Khi hủy đơn, số lượng nguyên liệu/sản phẩm
              đang giữ tạm (<code className="font-mono">QuantityReserved</code>)
              sẽ được hoàn trả lại vào kho khả dụng.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-700">
              Chọn nhanh lý do hủy:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setReason(preset);
                    setValidationError(null);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    reason === preset
                      ? "border-rose-400 bg-rose-50 text-rose-800"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="cancel-reason-input"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Lý do hủy đơn <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="cancel-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={isBusy}
              placeholder="Nhập chi tiết lý do hủy đơn (sẽ được lưu vào ghi chú đơn hàng)..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 disabled:bg-slate-100"
            />
            {validationError && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {validationError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Quay lại
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-50"
            >
              {isBusy
                ? "Đang hủy đơn..."
                : isPreparingOrFurther
                  ? "Xác nhận Hủy & Ghi nhận Waste"
                  : "Xác nhận Hủy đơn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

