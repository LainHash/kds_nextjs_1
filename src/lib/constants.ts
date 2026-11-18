export const KDS_AUTH_COOKIE = "kds_session";

export const KDS_STORAGE_KEYS = {
  accessToken: "kds.access_token",
  refreshToken: "kds.refresh_token",
  user: "kds.user",
  permissions: "kds.permissions",
  activeBranch: "kds.active_branch",
} as const;

export const KDS_REQUIRED_PERMISSIONS = {
  updatePreparation: "commerce:order-preparations:update",
  readPreparation: "commerce:order-preparations:read",
  readOrders: "commerce:orders:read",
  confirmOrders: "commerce:orders:confirm",
  cancelOrders: "commerce:orders:cancel",
} as const;

export const KDS_STAFF_ROLES = [
  "Superadmin",
  "SuperAdmin",
  "Admin",
  "Manager",
  "Employee",
] as const;

export const API_ENDPOINTS = {
  identity: {
    login: "/api/identity/authentication/login",
    refresh: "/api/identity/authentication/refresh",
    logout: "/api/identity/authentication/logout",
    logoutAll: "/api/identity/authentication/logout-all",
    mePermissions: "/api/identity/authentication/me/permissions",
    employeeByUser: (userId: string) =>
      `/api/identity/employees/by-user/${userId}`,
  },
  catalog: {
    products: "/api/catalog/products",
    productById: (id: string) => `/api/catalog/products/${id}`,
    categories: "/api/catalog/categories",
  },
  territory: {
    branches: "/api/territory/branches",
    branchById: (id: string) => `/api/territory/branches/${id}`,
    areas: "/api/territory/areas",
    restaurantTables: "/api/territory/restaurant-tables",
    productBranches: "/api/territory/product-branches",
    recipes: "/api/territory/recipes",
    recipeById: (id: string) => `/api/territory/recipes/${id}`,
    recipeStockStatus: "/api/territory/recipes/stock-status",
    ingredients: "/api/territory/ingredients",
    inventoryCategories: "/api/territory/categories",
  },
  commerce: {
    orders: "/api/commerce/orders",
    kitchenQueue: "/api/commerce/orders/kitchen-queue",
    orderById: (id: string) => `/api/commerce/orders/${id}`,
    confirmOrder: (id: string) => `/api/commerce/orders/${id}/confirm`,
    prepareOrder: (id: string) => `/api/commerce/orders/${id}/prepare`,
    readyOrder: (id: string) => `/api/commerce/orders/${id}/ready`,
    cancelOrder: (id: string) => `/api/commerce/orders/${id}/cancel`,
    advanceOrderItem: (orderItemId: string) =>
      `/api/commerce/order-preparations/order-items/${orderItemId}/advance`,
    revertOrderItem: (orderItemId: string) =>
      `/api/commerce/order-preparations/order-items/${orderItemId}/revert`,
    updateOrderItemStatus: (orderItemId: string) =>
      `/api/commerce/order-preparations/order-items/${orderItemId}/status`,
  },
} as const;
