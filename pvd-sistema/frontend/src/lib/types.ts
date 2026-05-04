// Tipos espelhando as entities do backend

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'DELIVERER';

export interface Store {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  taxFee: number;
  serviceFee: number;
  description?: string;
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  store?: { id: string; name: string };
}

export type OrderType = 'TABLE' | 'COUNTER' | 'DELIVERY' | 'TAKEOUT';
export type OrderStatus = 'OPEN' | 'SENT_KITCHEN' | 'PREPARING' | 'READY' | 'DELIVERING' | 'DELIVERED' | 'CLOSED' | 'CANCELLED';
export type OrderItemStatus = 'PENDING' | 'SENT' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type DeliveryStatus = 'WAITING' | 'READY' | 'DISPATCHED' | 'DELIVERED' | 'RETURNED';
export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'MEAL_VOUCHER' | 'STORE_CREDIT' | 'IFOOD_ONLINE' | 'OTHER';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  displayOrder: number;
  kitchenStation?: string;
  isActive: boolean;
  _count?: { products: number };
}

export interface Product {
  id: string;
  categoryId: string;
  sku?: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  imageUrl?: string;
  trackStock: boolean;
  stock: number;
  minStock: number;
  isActive: boolean;
  availableInDelivery: boolean;
  availableInStore: boolean;
  prepTimeMinutes?: number;
  displayOrder: number;
  category?: Category;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes?: string;
  status: OrderItemStatus;
  kitchenStation?: string;
  sentToKitchenAt?: string;
  readyAt?: string;
  modifiers: Array<{ id: string; name: string; priceDelta: number }>;
  product?: Product;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  totalOrders: number;
  totalSpent: number;
  addresses?: CustomerAddress[];
}

export interface CustomerAddress {
  id: string;
  label?: string;
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  reference?: string;
  isDefault: boolean;
  deliveryFee?: number;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  received?: number;
  change: number;
  cardBrand?: string;
  installments: number;
  processedAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  businessDate: string;
  type: OrderType;
  status: OrderStatus;
  reference?: string;
  customerId?: string;
  addressId?: string;
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  notes?: string;
  openedAt: string;
  sentToKitchenAt?: string;
  readyAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  items: OrderItem[];
  payments?: Payment[];
  customer?: Customer;
  address?: CustomerAddress;
}

export interface Delivery {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  delivererId?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  returnedAt?: string;
  actualMinutes?: number;
  order: Order;
  deliverer?: { id: string; name: string; phone?: string };
}

export interface Deliverer {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
  plate?: string;
  isActive: boolean;
}

export interface CouponCode {
  id: string;
  code: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minOrder: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

export type CashMovementType = 'OPENING' | 'SALE' | 'WITHDRAWAL' | 'REINFORCEMENT' | 'EXPENSE' | 'CLOSING';

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  description: string;
  createdAt: string;
  createdBy: string;
}

export interface CashSession {
  id: string;
  storeId: string;
  userId: string;
  businessDate: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  openedAt: string;
  closedAt?: string;
  notes?: string;
  user?: { id: string; name: string };
  movements: CashMovement[];
  _count?: { orders: number };
}
