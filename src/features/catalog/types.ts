export interface ProductResponse {
  id: string;
  name: string;
  description: string;
  categoryName: string;
  brandName: string;
  unitSymbol: string;
  inventoryType: string;
  currency?: string;
  unitPrice?: number;
  stockStatus?: string;
}

