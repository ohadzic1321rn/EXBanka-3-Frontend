import clientApi from './clientAuth'

// ─── Public-stocks (cross-bank catalogue) ──────────────────────────────

export interface InterbankPublicStockSeller {
  bankRoutingNumber: number
  bankDisplayName: string
  sellerId: string
  amount: number
}

export interface InterbankPublicStock {
  ticker: string
  sellers: InterbankPublicStockSeller[]
}

export interface InterbankPublicStocksResponse {
  stocks: InterbankPublicStock[]
  count: number
  partnerErrors: Record<string, string>
  partnerStale: Record<string, boolean>
  source: 'cache' | 'live'
}

// ─── Negotiations ──────────────────────────────────────────────────────

export type InterbankNegotiationRole = 'buyer' | 'seller'

export interface InterbankBankId {
  routingNumber: number
  id: string
}

export interface InterbankNegotiation {
  negotiationRoutingNumber: number
  negotiationId: string
  localRole: InterbankNegotiationRole
  counterpartyRoutingNumber: number
  buyerId: InterbankBankId
  sellerId: InterbankBankId
  stock: { ticker: string }
  amount: number
  pricePerUnit: { currency: string; amount: number }
  premium: { currency: string; amount: number }
  settlementDate: string
  lastModifiedBy: InterbankBankId
  isOngoing: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateInterbankNegotiationPayload {
  sellerId: InterbankBankId
  stock: { ticker: string }
  settlementDate: string
  pricePerUnit: { currency: string; amount: number }
  premium: { currency: string; amount: number }
  amount: number
}

export interface CounterInterbankNegotiationPayload {
  stock: { ticker: string }
  settlementDate: string
  pricePerUnit: { currency: string; amount: number }
  premium: { currency: string; amount: number }
  amount: number
}

// ─── Option contracts (buyer-side cross-bank options) ──────────────────

export type InterbankOptionContractStatus = 'valid' | 'exercised' | 'expired'

export interface InterbankOptionContract {
  id: number
  negotiationRoutingNumber: number
  negotiationId: string
  buyerLocalId: string
  sellerRoutingNumber: number
  sellerId: string
  stockTicker: string
  amount: number
  pricePerUnit: { currency: string; amount: number }
  premium: { currency: string; amount: number }
  settlementDate: string
  status: InterbankOptionContractStatus
  createdAt: string
  updatedAt: string
}

export interface ExerciseOptionContractResponse {
  exerciseId?: number
  status: 'committed' | 'rejected' | 'failed' | 'pending' | 'rolled_back'
  contract?: InterbankOptionContract
  message?: string
  vote?: unknown
}

// ─── API ───────────────────────────────────────────────────────────────

export const interbankOtcApi = {
  // public-stocks
  listPublicStocks: (live = false) =>
    clientApi.get<InterbankPublicStocksResponse>('/interbank-otc/public-stocks', {
      params: live ? { live: 'true' } : {},
    }),

  // negotiations
  listNegotiations: (role: '' | InterbankNegotiationRole = '', includeClosed = false) =>
    clientApi.get<{ negotiations: InterbankNegotiation[]; count: number }>(
      '/interbank-otc/negotiations',
      {
        params: {
          role: role || undefined,
          includeClosed: includeClosed ? 'true' : undefined,
        },
      },
    ),

  createNegotiation: (payload: CreateInterbankNegotiationPayload) =>
    clientApi.post<{ negotiation: InterbankNegotiation }>(
      '/interbank-otc/negotiations',
      payload,
    ),

  getNegotiation: (routingNumber: number, id: string) =>
    clientApi.get<{ negotiation: InterbankNegotiation }>(
      `/interbank-otc/negotiations/${routingNumber}/${encodeURIComponent(id)}`,
    ),

  counterNegotiation: (
    routingNumber: number,
    id: string,
    payload: CounterInterbankNegotiationPayload,
  ) =>
    clientApi.put<{ negotiation: InterbankNegotiation }>(
      `/interbank-otc/negotiations/${routingNumber}/${encodeURIComponent(id)}`,
      payload,
    ),

  acceptNegotiation: (routingNumber: number, id: string) =>
    clientApi.post<{ negotiation: InterbankNegotiation; contract?: InterbankOptionContract }>(
      `/interbank-otc/negotiations/${routingNumber}/${encodeURIComponent(id)}/accept`,
    ),

  closeNegotiation: (routingNumber: number, id: string) =>
    clientApi.delete<{ negotiation: InterbankNegotiation }>(
      `/interbank-otc/negotiations/${routingNumber}/${encodeURIComponent(id)}`,
    ),

  // option contracts
  listOptionContracts: () =>
    clientApi.get<{ contracts: InterbankOptionContract[]; count: number }>(
      '/interbank-otc/option-contracts',
    ),

  getOptionContract: (id: number) =>
    clientApi.get<{ contract: InterbankOptionContract }>(
      `/interbank-otc/option-contracts/${id}`,
    ),

  exerciseOptionContract: (id: number) =>
    clientApi.post<ExerciseOptionContractResponse>(
      `/interbank-otc/option-contracts/${id}/exercise`,
    ),
}
