import clientApi from './clientAuth'
import employeeApi from './client'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit'
export type OrderDirection = 'buy' | 'sell'
export type OrderStatus = 'pending' | 'approved' | 'declined' | 'done' | 'cancelled'

export interface CreateOrderPayload {
  assetTicker: string
  orderType: OrderType
  direction: OrderDirection
  quantity: number
  contractSize?: number
  limitValue?: number | null
  stopValue?: number | null
  isAON?: boolean
  isMargin?: boolean
  accountId: number
  afterHours?: boolean
}

export interface Order {
  id: number
  userId: number
  userType: string
  assetTicker: string
  assetName: string
  orderType: OrderType
  direction: OrderDirection
  quantity: number
  contractSize: number
  pricePerUnit: number
  limitValue: number | null
  stopValue: number | null
  isAON: boolean
  isMargin: boolean
  status: OrderStatus
  isDone: boolean
  remainingPortions: number
  afterHours: boolean
  accountId: number
  approvedBy: number | null
  lastModification: string
  createdAt: string
}

export interface CreateOrderResult {
  order: Order
  commission: number
  totalPrice: number
}

export interface OrdersResult {
  orders: Order[]
  count: number
}

export interface Transaction {
  id: number
  orderId: number
  quantity: number
  pricePerUnit: number
  executedAt: string
}

export interface TransactionsResult {
  transactions: Transaction[]
  count: number
}

// ---------------------------------------------------------------------------
// Client-facing order API  (uses client JWT)
// ---------------------------------------------------------------------------

export const clientOrderApi = {
  /** Create a new order (client). */
  createOrder: (payload: CreateOrderPayload) =>
    clientApi.post<CreateOrderResult>('/orders', payload),

  /** List all orders for the logged-in client. */
  listOrders: (status?: OrderStatus) =>
    clientApi.get<OrdersResult>('/orders', {
      params: { status: status || undefined },
    }),

  /** Get a single order by ID. */
  getOrder: (id: number) =>
    clientApi.get<{ order: Order }>(`/orders/${id}`),

  /** Cancel an order. Pass newRemaining > 0 for a partial cancel. */
  cancelOrder: (id: number, newRemaining = 0) =>
    clientApi.post<{ message: string }>(`/orders/${id}/cancel`, { newRemaining }),

  /** List fill transactions for an order. */
  listTransactions: (id: number) =>
    clientApi.get<TransactionsResult>(`/orders/${id}/transactions`),
}

// ---------------------------------------------------------------------------
// Employee-facing order API  (uses employee JWT)
// ---------------------------------------------------------------------------

export const employeeOrderApi = {
  /** Create a new order (agent/supervisor on behalf of a client). */
  createOrder: (payload: CreateOrderPayload) =>
    employeeApi.post<CreateOrderResult>('/orders', payload),

  /** List orders. Supervisors may pass userId + userType to see another user's orders. */
  listOrders: (params?: { status?: OrderStatus; userId?: number; userType?: string }) =>
    employeeApi.get<OrdersResult>('/orders', { params }),

  /** Get a single order by ID. */
  getOrder: (id: number) =>
    employeeApi.get<{ order: Order }>(`/orders/${id}`),

  /** Approve a pending order (supervisor only). */
  approveOrder: (id: number) =>
    employeeApi.post<{ message: string }>(`/orders/${id}/approve`),

  /** Decline a pending order (supervisor only). */
  declineOrder: (id: number) =>
    employeeApi.post<{ message: string }>(`/orders/${id}/decline`),

  /** Cancel an order. Pass newRemaining > 0 for a partial cancel. */
  cancelOrder: (id: number, newRemaining = 0) =>
    employeeApi.post<{ message: string }>(`/orders/${id}/cancel`, { newRemaining }),

  /** List fill transactions for an order. */
  listTransactions: (id: number) =>
    employeeApi.get<TransactionsResult>(`/orders/${id}/transactions`),
}
