import clientApi from './clientAuth'
import employeeApi from './client'

// ---------------------------------------------------------------------------
// Types — mirror holdingResponse from portfolio_http_handler.go
// ---------------------------------------------------------------------------

export interface Holding {
  id: number
  userId: number
  userType: string
  assetId: number
  assetTicker: string
  assetName: string
  assetType: string      // 'stock' | 'option' | 'forex' | 'futures'
  exchange: string
  currency: string
  quantity: number
  avgBuyPrice: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPct: number
  realizedProfit: number
  isPublic: boolean
  accountId: number
  createdAt: string
}

export interface HoldingsResult {
  holdings: Holding[]
  count: number
}

export interface PortfolioSummary {
  ownerId: string
  ownerType: string
  generatedAt: string
  estimatedValue: number
  unrealizedPnL: number
  realizedProfit: number
  positionCount: number
  holdings: Holding[]
}

// ---------------------------------------------------------------------------
// Client-facing portfolio API
// ---------------------------------------------------------------------------

export const clientPortfolioApi = {
  getSummary: () =>
    clientApi.get<{ portfolio: PortfolioSummary }>('/portfolio'),

  listHoldings: () =>
    clientApi.get<HoldingsResult>('/portfolio/holdings'),

  getHolding: (id: number) =>
    clientApi.get<{ holding: Holding }>(`/portfolio/holdings/${id}`),

  setPublic: (id: number, isPublic: boolean) =>
    clientApi.put<{ holdingId: number; isPublic: boolean }>(
      `/portfolio/holdings/${id}/public`,
      { isPublic }
    ),
}

// ---------------------------------------------------------------------------
// Employee-facing portfolio API
// ---------------------------------------------------------------------------

export const employeePortfolioApi = {
  getSummary: () =>
    employeeApi.get<{ portfolio: PortfolioSummary }>('/portfolio'),

  listHoldings: () =>
    employeeApi.get<HoldingsResult>('/portfolio/holdings'),

  getHolding: (id: number) =>
    employeeApi.get<{ holding: Holding }>(`/portfolio/holdings/${id}`),

  /** Exercise an in-the-money option holding (actuary only). */
  exerciseOption: (holdingId: number) =>
    employeeApi.post<{ message: string }>(`/portfolio/holdings/${holdingId}/exercise`),

  setPublic: (id: number, isPublic: boolean) =>
    employeeApi.put<{ holdingId: number; isPublic: boolean }>(
      `/portfolio/holdings/${id}/public`,
      { isPublic }
    ),
}
