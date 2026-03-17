import clientApi from './clientAuth'

export interface TransferItem {
  id: string
  racunPosiljaocaId: string
  racunPrimaocaId: string
  iznos: number
  valutaIznosa: string
  konvertovaniIznos: number
  kurs: number
  svrha: string
  status: string
  vremeTransakcije: string
}

export interface CreateTransferPayload {
  racunPosiljaocaId: number
  racunPrimaocaId: number
  iznos: number
  svrha: string
}

export interface TransferFilter {
  dateFrom?: string
  dateTo?: string
  minAmount?: number
  maxAmount?: number
  status?: string
  page?: number
  pageSize?: number
}

export const transferApi = {
  create: (data: CreateTransferPayload) =>
    clientApi.post('/transfers', {
      racun_posiljaoca_id: data.racunPosiljaocaId,
      racun_primaoca_id:   data.racunPrimaocaId,
      iznos:               data.iznos,
      svrha:               data.svrha,
    }),

  listByClient: (clientId: string, filter: TransferFilter = {}) =>
    clientApi.get(`/transfers/client/${clientId}`, {
      params: {
        date_from:  filter.dateFrom,
        date_to:    filter.dateTo,
        min_amount: filter.minAmount,
        max_amount: filter.maxAmount,
        status:     filter.status,
        page:       filter.page,
        page_size:  filter.pageSize,
      },
    }),

  listByAccount: (accountId: string, filter: TransferFilter = {}) =>
    clientApi.get(`/transfers/account/${accountId}`, {
      params: {
        date_from:  filter.dateFrom,
        date_to:    filter.dateTo,
        min_amount: filter.minAmount,
        max_amount: filter.maxAmount,
        status:     filter.status,
        page:       filter.page,
        page_size:  filter.pageSize,
      },
    }),

  calculateExchange: (fromCurrency: string, toCurrency: string, amount: number) =>
    clientApi.post('/exchange/calculate', {
      from_currency: fromCurrency,
      to_currency:   toCurrency,
      amount,
    }),
}
