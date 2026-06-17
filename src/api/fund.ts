// Fund API — works against both the employee token (sessionStorage.access_token)
// and the client token (sessionStorage.client_access_token). The choice is made
// by which axios instance the caller imports.

import employeeApi from './client'
import clientApi from './clientAuth'

export type FundDividendPolicy = 'reinvest' | 'payout'

export interface FundStatistics {
  available: boolean
  monthsOfData: number
  annualizedReturn: number
  volatility: number
  rewardToVariability: number
  maxDrawdown: number
}

export interface FundSummary {
  id: number
  naziv: string
  opis: string
  minimalniUlog: number
  managerId: number
  accountId: number
  datumKreiranja: string
  dividendPolicy: FundDividendPolicy
  fundValueRSD: number
  liquidCashRSD: number
  holdingsValueRSD: number
  totalInvestedRSD: number
  profitRSD: number
  participantsCount: number
  withdrawalCommRate: number
  statistics?: FundStatistics
}

export interface FundDividend {
  id: number
  assetId: number
  ticker: string
  period: string
  quantity: number
  grossRSD: number
  policy: FundDividendPolicy
  reinvestedShares: number
  reinvestedRSD: number
  distributedRSD: number
  paidAt: string
}

export interface FundDividendPayout {
  id: number
  assetId: number
  ticker: string
  period: string
  clientId: number
  clientType: string
  accountId: number
  amountRSD: number
  paidAt: string
}

export interface BenchmarkPoint {
  date: string
  indexValue: number
}

export interface FundHolding {
  id: number
  assetId: number
  ticker: string
  name: string
  price: number
  change: number
  volume: number
  quantity: number
  avgBuyPrice: number
  acquisitionDate: string
  initialMarginCost: number
}

export interface FundPerformancePoint {
  date: string
  fundValue: number
}

export interface FundPositionView {
  fundId: number
  naziv: string
  ukupanUlozeniRSD: number
  udeoProcenat: number
  trenutnaVrednost: number
  profitRSD: number
  fundValueRSD: number
}

export interface InvestInFundPayload {
  sourceAccountId: number
  amount: number
  asBank?: boolean
}

export interface WithdrawFromFundPayload {
  destinationAccountId: number
  amount?: number
  withdrawAll?: boolean
  asBank?: boolean
}

export interface CreateFundPayload {
  naziv: string
  opis: string
  minimalniUlog: number
}

export interface WithdrawResult {
  grossWithdrawn: number
  commission: number
  netToAccount: number
  liquidated: boolean
  liquidatedItems: Array<{
    assetId: number
    ticker: string
    quantity: number
    pricePerRSD: number
    totalRSD: number
  }>
}

function fundApiFor(axiosInstance: typeof employeeApi) {
  return {
    list: () => axiosInstance.get<{ funds: FundSummary[]; count: number }>('/funds'),
    get: (id: number) => axiosInstance.get<{ fund: FundSummary }>(`/funds/${id}`),
    holdings: (id: number) =>
      axiosInstance.get<{ holdings: FundHolding[]; count: number }>(`/funds/${id}/holdings`),
    performance: (id: number, granularity: 'monthly' | 'quarterly' | 'yearly' | 'all' = 'monthly') =>
      axiosInstance.get<{ performance: FundPerformancePoint[]; count: number; granularity: string }>(
        `/funds/${id}/performance`,
        { params: { granularity } },
      ),
    statistics: (id: number) =>
      axiosInstance.get<{ statistics: FundStatistics }>(`/funds/${id}/statistics`),
    dividends: (id: number) =>
      axiosInstance.get<{ dividends: FundDividend[]; count: number; payouts: FundDividendPayout[] }>(
        `/funds/${id}/dividends`,
      ),
    benchmark: () =>
      axiosInstance.get<{ benchmark: BenchmarkPoint[]; count: number }>('/funds/benchmark'),
    setDividendPolicy: (id: number, policy: FundDividendPolicy) =>
      axiosInstance.put<{ fundId: number; dividendPolicy: FundDividendPolicy }>(
        `/funds/${id}/dividend-policy`,
        { policy },
      ),
    runDividends: () =>
      axiosInstance.post<{ period: string; eligible: number; processed: number; skipped: number; failed: number }>(
        '/funds/dividends/run',
      ),
    invest: (fundId: number, payload: InvestInFundPayload) =>
      axiosInstance.post(`/funds/${fundId}/invest`, payload),
    withdraw: (fundId: number, payload: WithdrawFromFundPayload) =>
      axiosInstance.post<WithdrawResult>(`/funds/${fundId}/withdraw`, payload),
    create: (payload: CreateFundPayload) =>
      axiosInstance.post<{ fund: FundSummary }>('/funds', payload),
    mine: () =>
      axiosInstance.get<{
        funds?: FundSummary[]
        positions?: FundPositionView[]
        count: number
        role: 'client' | 'supervisor'
      }>('/funds/positions/mine'),
    transferOwnership: (oldManagerId: number, newManagerId: number) =>
      axiosInstance.post<{ reassigned: number }>('/funds/transfer-ownership', {
        oldManagerId,
        newManagerId,
      }),
  }
}

export const fundApi = fundApiFor(employeeApi)
export const clientFundApi = fundApiFor(clientApi)
