import clientApi from './clientAuth'
import type { ExchangeSummary } from './market'

export interface PublicOtcStock {
  holdingId: number
  sellerId: number
  sellerType: string
  assetId: number
  ticker: string
  name: string
  exchange: string
  currency: string
  price: number
  ask: number
  bid: number
  publicQuantity: number
  reservedQuantity: number
  availableQuantity: number
  lastRefresh: string
}

export type OtcContractStatus = '' | 'valid' | 'expired' | 'exercised'
export type OtcOfferStatus = '' | 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface OtcContract {
  id: number
  offerId?: number
  stockListingId: number
  sellerHoldingId: number
  ticker: string
  name: string
  exchange: ExchangeSummary
  amount: number
  strikePrice: number
  currentPrice: number
  exercisedAtPrice: number
  premium: number
  profit: number // buyer's P&L (legacy alias for buyerProfit)
  buyerProfit: number
  sellerProfit: number
  settlementDate: string
  buyerId: number
  buyerType: string
  buyerAccountId: number
  sellerId: number
  sellerType: string
  sellerAccountId: number
  status: Exclude<OtcContractStatus, ''>
  createdAt: string
}

export interface OtcOffer {
  id: number
  stockListingId: number
  sellerHoldingId: number
  ticker: string
  name: string
  exchange: ExchangeSummary
  amount: number
  pricePerStock: number
  currentPrice: number
  deviationPct: number
  settlementDate: string
  premium: number
  lastModified: string
  modifiedById: number
  modifiedByType: string
  status: Exclude<OtcOfferStatus, ''>
  buyerId: number
  buyerType: string
  buyerAccountId: number
  sellerId: number
  sellerType: string
  sellerAccountId: number
}

export interface CreateOtcOfferPayload {
  sellerHoldingId: number
  buyerAccountId: number
  amount: number
  pricePerStock: number
  settlementDate: string
  premium: number
}

export interface CounterOtcOfferPayload {
  amount: number
  pricePerStock: number
  settlementDate: string
  premium: number
}

export type SagaStatus =
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolling_back'
  | 'rolled_back'
  | 'requires_manual_intervention'

export type SagaStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'compensated'

export interface SagaStep {
  stepNumber: number
  name: string
  status: SagaStepStatus
  executedAt?: string
  errorMessage?: string
}

export interface SagaTransaction {
  id: number
  type: string
  status: SagaStatus
  currentStep: number
  retryCount: number
  error?: string
  createdAt: string
  updatedAt: string
  steps: SagaStep[]
}

export interface ExerciseContractResponse {
  sagaId: number
  contract?: OtcContract
  message?: string
}

export const otcApi = {
  listPublicStocks: () =>
    clientApi.get<{ stocks: PublicOtcStock[]; count: number }>('/otc/public-stocks'),

  listContracts: (status: OtcContractStatus = '') =>
    clientApi.get<{ contracts: OtcContract[]; count: number; status: string }>('/otc/contracts', {
      params: { status: status || undefined },
    }),

  createOffer: (payload: CreateOtcOfferPayload) =>
    clientApi.post<{ offer: OtcOffer }>('/otc/offers', payload),

  listOffers: (status: OtcOfferStatus = '') =>
    clientApi.get<{ offers: OtcOffer[]; count: number; status: string }>('/otc/offers', {
      params: { status: status || undefined },
    }),

  counterOffer: (offerId: number, payload: CounterOtcOfferPayload) =>
    clientApi.post<{ offer: OtcOffer }>(`/otc/offers/${offerId}/counter`, payload),

  acceptOffer: (offerId: number) =>
    clientApi.post<{ contract: OtcContract }>(`/otc/offers/${offerId}/accept`),

  declineOffer: (offerId: number) =>
    clientApi.post<{ offer: OtcOffer }>(`/otc/offers/${offerId}/decline`),

  cancelOffer: (offerId: number) =>
    clientApi.post<{ offer: OtcOffer }>(`/otc/offers/${offerId}/cancel`),

  exerciseContract: (contractId: number) =>
    clientApi.post<ExerciseContractResponse>(`/otc/contracts/${contractId}/exercise`),

  getSagaStatus: (sagaId: number) =>
    clientApi.get<{ saga: SagaTransaction }>(`/otc/saga/${sagaId}`),
}
