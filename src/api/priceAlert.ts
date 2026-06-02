import clientApi from './clientAuth'

export interface PriceAlert {
  id: number
  user_id: number
  user_type: string
  ticker: string
  condition: 'ABOVE' | 'BELOW'
  threshold: number
  notification_email: string
  is_active: boolean
  created_at: string
}

export const priceAlertApi = {
  list: () =>
    clientApi.get<PriceAlert[]>('/price-alerts'),

  create: (ticker: string, condition: 'ABOVE' | 'BELOW', threshold: number) =>
    clientApi.post<PriceAlert>('/price-alerts', { ticker, condition, threshold }),

  remove: (id: number) =>
    clientApi.delete(`/price-alerts/${id}`),
}
