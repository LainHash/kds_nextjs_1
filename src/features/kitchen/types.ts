export type KitchenOrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export interface KitchenOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  note?: string;
  status: KitchenOrderStatus;
}

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  branchId: string;
  tableNumber?: string;
  status: KitchenOrderStatus;
  createdAt: string;
  items: KitchenOrderItem[];
}

