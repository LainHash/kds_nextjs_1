import type { PaginationParams } from "@/types/api";

export type OrderStatus =
  | "Draft"
  | "Pending"
  | "Confirmed"
  | "Preparing"
  | "Served"
  | "ReadyForPickup"
  | "ReadyForDelivery"
  | "Delivering"
  | "Completed"
  | "Cancelled";

export type OrderType = "DineIn" | "TakeAway" | "Delivery";

export type PaymentTiming = "Postpay" | "Prepay";

export type PaymentStatus = "Paid" | "Unpaid" | "Refund";

export type PreparationStatus =
  | "Pending"
  | "Preparing"
  | "Ready"
  | "Cancelled";

export interface OrderItemResponse {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note?: string | null;
  preparationStatus?: PreparationStatus | null;
  preparationStartedAt?: string | null;
  preparationCompletedAt?: string | null;
}

export interface PaymentResponse {
  id: string;
  orderId: string;
  orderCode?: string | null;
  method: string;
  amount: number;
  status: string;
  providerTransactionId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderResponse {
  id: string;
  orderCode: string;
  status: OrderStatus;
  type: OrderType;
  paymentTiming: PaymentTiming;
  paymentStatus: PaymentStatus;
  customerId?: string | null;
  employeeId?: string | null;
  restaurantTableId?: string | null;
  branchId: string;
  subtotal: number;
  discountAmount: number;
  voucherId?: string | null;
  voucherCode?: string | null;
  voucherDiscountAmount?: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  note?: string | null;
  deliveryAddress?: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetailResponse extends OrderResponse {
  orderItems: OrderItemResponse[];
  payments?: PaymentResponse[];
}

export interface OrderPreparationStatusResponse {
  orderItemId: string;
  previousStatus: PreparationStatus;
  currentStatus: PreparationStatus;
  orderStatus?: OrderStatus | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface KitchenQueueQueryParams extends PaginationParams {
  branchId?: string;
  restaurantTableId?: string;
  type?: OrderType;
  paymentStatus?: PaymentStatus;
  statuses?: OrderStatus[];
  from?: string;
  to?: string;
}

export interface OrdersQueryParams extends PaginationParams {
  branchId?: string;
  customerId?: string;
  employeeId?: string;
  restaurantTableId?: string;
  status?: OrderStatus;
  type?: OrderType;
  paymentStatus?: PaymentStatus;
  paymentTiming?: PaymentTiming;
  from?: string;
  to?: string;
}

export type KitchenBoardStage = "Confirmed" | "Preparing" | "Ready";

export type KitchenStageFilter = "ALL" | KitchenBoardStage;

export type OrderTypeFilter = "ALL" | OrderType;

export type KdsBoardViewMode = "kanban" | "grid";

export type SlaLevel = "normal" | "warning" | "critical";

export interface SlaThresholdConfig {
  warningMinutes: number;
  criticalMinutes: number;
}
