import clientApi from './clientAuth'

export interface Watchlist {
  id: number
  user_id: number
  user_type: string
  name: string
  created_at: string
}

export interface WatchlistItem {
  id: number
  ticker: string
  name: string
  type: string
  price: number
  change: number
  volume: number
  added_at: string
}

export const watchlistApi = {
  listWatchlists: () =>
    clientApi.get<Watchlist[]>('/watchlists'),

  createWatchlist: (name: string) =>
    clientApi.post<Watchlist>('/watchlists', { name }),

  deleteWatchlist: (id: number) =>
    clientApi.delete(`/watchlists/${id}`),

  getItems: (id: number) =>
    clientApi.get<WatchlistItem[]>(`/watchlists/${id}/items`),

  addItem: (id: number, ticker: string) =>
    clientApi.post(`/watchlists/${id}/items`, { ticker }),

  // ticker may contain "/" (e.g. EUR/USD) — pass raw in path, backend handles it
  removeItem: (id: number, ticker: string) =>
    clientApi.delete(`/watchlists/${id}/items/${ticker}`),
}
