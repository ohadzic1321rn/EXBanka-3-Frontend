import clientApi from './clientAuth'

export interface PaymentItem {
  id: string
  racunPosiljaocaId: string
  racunPrimaocaBroj: string
  iznos: number
  sifraPlacanja: string
  pozivNaBroj: string
  svrha: string
  status: string
  verifikacioniKod?: string
  vremeTransakcije: string
}

export interface CreatePaymentPayload {
  racunPosiljaocaId: number
  racunPrimaocaBroj: string
  iznos: number
  sifraPlacanja: string
  pozivNaBroj: string
  svrha: string
  recipientId?: number
}

export interface PaymentFilter {
  status?: string
  dateFrom?: string
  dateTo?: string
  minAmount?: number
  maxAmount?: number
  page?: number
  pageSize?: number
}

export const SIFRE_PLACANJA = [
  { sifra: '221', naziv: 'Plaćanje robe' },
  { sifra: '222', naziv: 'Plaćanje usluga' },
  { sifra: '240', naziv: 'Komunalne usluge' },
  { sifra: '253', naziv: 'Osiguranje' },
  { sifra: '254', naziv: 'Prenos sredstava' },
  { sifra: '265', naziv: 'Uplata kredita' },
  { sifra: '270', naziv: 'Donacija' },
  { sifra: '289', naziv: 'Ostala plaćanja' },
  { sifra: '290', naziv: 'Interno plaćanje' },
]

export const paymentApi = {
  create: (data: CreatePaymentPayload) =>
    clientApi.post('/payments', {
      racun_posiljaoca_id:  data.racunPosiljaocaId,
      racun_primaoca_broj:  data.racunPrimaocaBroj,
      iznos:                data.iznos,
      sifra_placanja:       data.sifraPlacanja,
      poziv_na_broj:        data.pozivNaBroj,
      svrha:                data.svrha,
      recipient_id:         data.recipientId,
    }),

  verify: (paymentId: string, verificationCode: string) =>
    clientApi.post(`/payments/${paymentId}/verify`, {
      verification_code: verificationCode,
    }),

  listByClient: (clientId: string, filter: PaymentFilter = {}) =>
    clientApi.get(`/payments/client/${clientId}`, {
      params: {
        status:     filter.status,
        date_from:  filter.dateFrom,
        date_to:    filter.dateTo,
        min_amount: filter.minAmount,
        max_amount: filter.maxAmount,
        page:       filter.page,
        page_size:  filter.pageSize,
      },
    }),

  listByAccount: (accountId: string, filter: PaymentFilter = {}) =>
    clientApi.get(`/payments/account/${accountId}`, {
      params: {
        status:     filter.status,
        date_from:  filter.dateFrom,
        date_to:    filter.dateTo,
        min_amount: filter.minAmount,
        max_amount: filter.maxAmount,
        page:       filter.page,
        page_size:  filter.pageSize,
      },
    }),

  get: (id: string) =>
    clientApi.get(`/payments/${id}`),
}

export interface CrossBankPaymentResponse {
  id: number
  transactionId: { routingNumber: number; id: string }
  direction: string
  partnerRoutingNumber: number
  senderAccountNumber: string
  recipientAccountNumber: string
  currency: string
  amount: number
  message?: string
  paymentCode?: string
  paymentPurpose?: string
  status: 'pending' | 'committed' | 'rejected' | 'failed' | 'rolled_back'
  lastError?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
}

export interface CreateCrossBankPayload {
  senderAccountNumber: string
  recipientAccountNumber: string
  currency: string
  amount: number
  message?: string
  paymentCode?: string
  paymentPurpose?: string
}

export const crossBankPaymentApi = {
  create: (data: CreateCrossBankPayload) =>
    clientApi.post('/payments/cross-bank', data),

  list: (limit = 50) =>
    clientApi.get('/payments/cross-bank', { params: { limit } }),

  get: (id: number | string) =>
    clientApi.get(`/payments/cross-bank/${id}`),
}
