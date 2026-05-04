import { api } from './api';
import type {
  Category, Product, Order, OrderItem, Customer, CustomerAddress,
  Delivery, Deliverer, OrderType, PaymentMethod, TeamUser, UserRole, Store, CouponCode,
  CashSession, CashMovementType,
} from '@/lib/types';

// ═══════════ CATEGORIES ═══════════
export const categoriesApi = {
  list: (storeId: string) => api.get<{ categories: Category[] }>('/categories', { params: { storeId } }).then(r => r.data.categories),
  create: (data: Partial<Category> & { storeId: string }) => api.post<{ category: Category }>('/categories', data).then(r => r.data.category),
  update: (id: string, data: Partial<Category>) => api.patch<{ category: Category }>(`/categories/${id}`, data).then(r => r.data.category),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// ═══════════ PRODUCTS ═══════════
export const productsApi = {
  list: (params: { storeId: string; categoryId?: string; search?: string; activeOnly?: boolean }) =>
    api.get<{ products: Product[] }>('/products', { params }).then(r => r.data.products),
  get: (id: string) => api.get<{ product: Product }>(`/products/${id}`).then(r => r.data.product),
  create: (data: Partial<Product> & { storeId: string; categoryId: string; name: string; price: number }) =>
    api.post<{ product: Product }>('/products', data).then(r => r.data.product),
  update: (id: string, data: Partial<Product>) =>
    api.patch<{ product: Product }>(`/products/${id}`, data).then(r => r.data.product),
  delete: (id: string) => api.delete(`/products/${id}`),
  adjustStock: (id: string, delta: number, reason?: string) =>
    api.post<{ product: Product }>(`/products/${id}/stock-adjust`, { delta, reason }).then(r => r.data.product),
};

// ═══════════ ORDERS ═══════════
export const ordersApi = {
  listOpen: (storeId: string) => api.get<{ orders: Order[] }>('/orders/open', { params: { storeId } }).then(r => r.data.orders),
  list: (params: { storeId: string; status?: string; date?: string }) =>
    api.get<{ orders: Order[] }>('/orders', { params }).then(r => r.data.orders),
  get: (id: string) => api.get<{ order: Order }>(`/orders/${id}`).then(r => r.data.order),

  create: (data: { storeId: string; type: OrderType; reference?: string; customerId?: string; addressId?: string; notes?: string }) =>
    api.post<{ order: Order }>('/orders', data).then(r => r.data.order),

  addItem: (orderId: string, item: { productId: string; quantity: number; notes?: string; modifierIds?: string[] }) =>
    api.post<{ order: Order }>(`/orders/${orderId}/items`, item).then(r => r.data.order),

  removeItem: (orderId: string, itemId: string) =>
    api.delete<{ order: Order }>(`/orders/${orderId}/items/${itemId}`).then(r => r.data.order),

  updateItemNotes: (orderId: string, itemId: string, notes: string) =>
    api.patch<{ item: OrderItem }>(`/orders/${orderId}/items/${itemId}`, { notes }).then(r => r.data.item),

  sendToKitchen: (orderId: string) =>
    api.post<{ order: Order }>(`/orders/${orderId}/send-to-kitchen`).then(r => r.data.order),

  markItemReady: (orderId: string, itemId: string) =>
    api.post<{ order: Order }>(`/orders/${orderId}/items/${itemId}/ready`).then(r => r.data.order),

  markAllReady: (orderId: string) =>
    api.post<{ order: Order }>(`/orders/${orderId}/mark-all-ready`).then(r => r.data.order),

  close: (orderId: string, payments: Array<{ method: PaymentMethod; amount: number; received?: number }>) =>
    api.post<{ order: Order }>(`/orders/${orderId}/close`, { payments }).then(r => r.data.order),

  cancel: (orderId: string, reason: string) =>
    api.post(`/orders/${orderId}/cancel`, { reason }),

  applyDiscount: (orderId: string, type: 'PERCENTAGE' | 'FIXED', value: number, reason?: string, couponId?: string) =>
    api.post<{ order: Order }>(`/orders/${orderId}/discount`, { type, value, reason, couponId }).then(r => r.data.order),
};

// ═══════════ CUSTOMERS ═══════════
export const customersApi = {
  search: (storeId: string, query: string) =>
    api.get<{ customers: Customer[] }>('/customers', { params: { storeId, search: query } }).then(r => r.data.customers),
  searchByPhone: (phone: string) =>
    api.get<{ customer: Customer | null }>(`/customers/search-phone/${phone}`).then(r => r.data.customer),
  create: (data: { storeId: string; name: string; phone?: string; email?: string }) =>
    api.post<{ customer: Customer }>('/customers', data).then(r => r.data.customer),
  update: (id: string, data: Partial<Customer>) =>
    api.patch<{ customer: Customer }>(`/customers/${id}`, data).then(r => r.data.customer),
  addAddress: (customerId: string, data: Partial<CustomerAddress> & { street: string }) =>
    api.post<{ address: CustomerAddress }>(`/customers/${customerId}/addresses`, data).then(r => r.data.address),
};

// ═══════════ DELIVERIES ═══════════
export const deliveriesApi = {
  list: (storeId: string, status?: string, date?: string) =>
    api.get<{ deliveries: Delivery[] }>('/deliveries', {
      params: { ...(storeId ? { storeId } : {}), ...(status ? { status } : {}), ...(date ? { date } : {}) },
    }).then(r => r.data.deliveries),
  assign: (deliveryId: string, delivererId: string) =>
    api.post<{ delivery: Delivery }>(`/deliveries/${deliveryId}/assign`, { delivererId }).then(r => r.data.delivery),
  updateStatus: (deliveryId: string, status: string) =>
    api.post<{ delivery: Delivery }>(`/deliveries/${deliveryId}/status`, { status }).then(r => r.data.delivery),
};

export const deliverersApi = {
  list: (storeId?: string) =>
    api.get<{ deliverers: Deliverer[] }>('/deliveries/deliverers', { params: { storeId } }).then(r => r.data.deliverers),
  create: (data: { storeId: string; name: string; phone?: string }) =>
    api.post<{ deliverer: Deliverer }>('/deliveries/deliverers', data).then(r => r.data.deliverer),
};

// ═══════════ STORES ═══════════
export const storesApi = {
  list: () => api.get<{ stores: Store[] }>('/stores').then(r => r.data.stores),
  create: (data: { name: string; address?: string; phone?: string; taxFee?: number; description?: string }) =>
    api.post<{ store: Store }>('/stores', data).then(r => r.data.store),
  update: (id: string, data: Partial<Store>) =>
    api.patch<{ store: Store }>(`/stores/${id}`, data).then(r => r.data.store),
};

// ═══════════ USERS (EQUIPE) ═══════════
export const usersApi = {
  list: () => api.get<{ users: TeamUser[] }>('/users').then(r => r.data.users),
  create: (data: { name: string; email: string; password: string; role: UserRole; pin?: string }) =>
    api.post<{ user: TeamUser }>('/users', data).then(r => r.data.user),
  update: (id: string, data: Partial<{ name: string; email: string; role: UserRole; pin: string; isActive: boolean }>) =>
    api.patch<{ user: TeamUser }>(`/users/${id}`, data).then(r => r.data.user),
  changePassword: (id: string, password: string) =>
    api.patch(`/users/${id}/password`, { password }),
  remove: (id: string) => api.delete(`/users/${id}`),
};

// ═══════════ COUPONS ═══════════
export const couponsApi = {
  list: () => api.get<{ coupons: CouponCode[] }>('/coupons').then(r => r.data.coupons),
  create: (data: { code: string; description?: string; type: 'PERCENTAGE' | 'FIXED'; value: number; minOrder?: number; maxUses?: number; isActive?: boolean; expiresAt?: string }) =>
    api.post<{ coupon: CouponCode }>('/coupons', data).then(r => r.data.coupon),
  update: (id: string, data: Partial<{ code: string; description: string; type: 'PERCENTAGE' | 'FIXED'; value: number; minOrder: number; maxUses: number; isActive: boolean; expiresAt: string }>) =>
    api.patch<{ coupon: CouponCode }>(`/coupons/${id}`, data).then(r => r.data.coupon),
  remove: (id: string) => api.delete(`/coupons/${id}`),
  validate: (code: string, orderTotal: number) =>
    api.post<{ coupon: CouponCode; discountAmount: number; finalTotal: number }>('/coupons/validate', { code, orderTotal }).then(r => r.data),
};

// ═══════════ CASH SESSIONS ═══════════
export const cashSessionsApi = {
  getCurrent: (storeId: string) =>
    api.get<{ session: CashSession | null }>('/cash-sessions/current', { params: { storeId } }).then(r => r.data.session),

  getHistory: (storeId: string, from?: string, to?: string) =>
    api.get<{ sessions: CashSession[] }>('/cash-sessions', { params: { storeId, from, to } }).then(r => r.data.sessions),

  open: (storeId: string, openingAmount: number) =>
    api.post<{ session: CashSession }>('/cash-sessions/open', { storeId, openingAmount }).then(r => r.data.session),

  close: (sessionId: string, closingAmount: number, notes?: string) =>
    api.post<{ session: CashSession; summary: any }>(`/cash-sessions/${sessionId}/close`, { closingAmount, notes }).then(r => r.data),

  addMovement: (sessionId: string, type: Exclude<CashMovementType, 'OPENING' | 'SALE' | 'CLOSING'>, amount: number, description: string) =>
    api.post<{ movement: any }>(`/cash-sessions/${sessionId}/movement`, { type, amount, description }).then(r => r.data.movement),

  getDetails: (sessionId: string) =>
    api.get<{ session: CashSession; summary: any }>(`/cash-sessions/${sessionId}`).then(r => r.data),
};

// ═══════════ REPORTS ═══════════
export const reportsApi = {
  dashboard: (storeId: string, date?: string) =>
    api.get('/reports/dashboard', { params: { storeId, date } }).then(r => r.data),
  period: (storeId: string, from: string, to: string) =>
    api.get('/reports/period', { params: { storeId, from, to } }).then(r => r.data),
  lowStock: (storeId: string) =>
    api.get<{ products: Product[] }>('/reports/low-stock', { params: { storeId } }).then(r => r.data.products),
};
