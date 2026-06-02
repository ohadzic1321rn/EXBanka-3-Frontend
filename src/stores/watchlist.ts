import { defineStore } from 'pinia'
import { ref } from 'vue'
import { watchlistApi, type Watchlist, type WatchlistItem } from '../api/watchlist'

export const useWatchlistStore = defineStore('watchlist', () => {
  const watchlists = ref<Watchlist[]>([])
  const currentWatchlistId = ref<number | null>(null)
  const currentItems = ref<WatchlistItem[]>([])
  const allTrackedItems = ref<WatchlistItem[]>([])

  const loading = ref(false)
  const itemsLoading = ref(false)
  const error = ref('')
  const itemsError = ref('')

  async function fetchWatchlists() {
    loading.value = true
    error.value = ''
    try {
      const res = await watchlistApi.listWatchlists()
      watchlists.value = res.data ?? []
      // Auto-select first list if none selected
      if (currentWatchlistId.value === null && watchlists.value.length > 0) {
        currentWatchlistId.value = watchlists.value[0]?.id ?? null
      }
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Greška pri učitavanju watchlista.'
      watchlists.value = []
    } finally {
      loading.value = false
    }
  }

  async function createWatchlist(name: string) {
    error.value = ''
    try {
      const res = await watchlistApi.createWatchlist(name)
      const created = res.data
      watchlists.value.push(created)
      currentWatchlistId.value = created.id
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Greška pri kreiranju watchliste.'
      throw e
    }
  }

  async function deleteWatchlist(id: number) {
    error.value = ''
    try {
      await watchlistApi.deleteWatchlist(id)
      watchlists.value = watchlists.value.filter((w) => w.id !== id)
      if (currentWatchlistId.value === id) {
        currentWatchlistId.value = watchlists.value[0]?.id ?? null
        currentItems.value = []
      }
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Greška pri brisanju watchliste.'
      throw e
    }
  }

  async function fetchItems(id: number) {
    itemsLoading.value = true
    itemsError.value = ''
    try {
      const res = await watchlistApi.getItems(id)
      currentItems.value = res.data ?? []
    } catch (e: any) {
      itemsError.value = e?.response?.data?.message ?? 'Greška pri učitavanju stavki.'
      currentItems.value = []
    } finally {
      itemsLoading.value = false
    }
  }

  async function selectWatchlist(id: number) {
    currentWatchlistId.value = id
    await fetchItems(id)
  }

  async function refreshCurrentItems() {
    if (currentWatchlistId.value !== null) {
      await fetchItems(currentWatchlistId.value)
    }
  }

  async function addItem(ticker: string) {
    if (currentWatchlistId.value === null) return
    itemsError.value = ''
    try {
      await watchlistApi.addItem(currentWatchlistId.value, ticker)
      await fetchItems(currentWatchlistId.value)
    } catch (e: any) {
      throw e
    }
  }

  async function removeItem(ticker: string) {
    if (currentWatchlistId.value === null) return
    itemsError.value = ''
    try {
      await watchlistApi.removeItem(currentWatchlistId.value, ticker)
      currentItems.value = currentItems.value.filter((i) => i.ticker !== ticker)
    } catch (e: any) {
      itemsError.value = e?.response?.data?.message ?? 'Greška pri uklanjanju stavke.'
      throw e
    }
  }

  // Fetch items from ALL watchlists, deduplicated by ticker — used by WatchlistTickerStrip
  async function fetchAllTracked() {
    if (watchlists.value.length === 0) {
      await fetchWatchlists()
    }
    if (watchlists.value.length === 0) {
      allTrackedItems.value = []
      return
    }
    try {
      const results = await Promise.all(
        watchlists.value.map((wl) => watchlistApi.getItems(wl.id).then((r) => r.data ?? []))
      )
      const seen = new Set<string>()
      const flat: WatchlistItem[] = []
      for (const items of results) {
        for (const item of items) {
          if (!seen.has(item.ticker)) {
            seen.add(item.ticker)
            flat.push(item)
          }
        }
      }
      allTrackedItems.value = flat
    } catch {
      // silent — strip just shows stale data
    }
  }

  return {
    watchlists,
    currentWatchlistId,
    currentItems,
    allTrackedItems,
    loading,
    itemsLoading,
    error,
    itemsError,
    fetchWatchlists,
    createWatchlist,
    deleteWatchlist,
    fetchItems,
    selectWatchlist,
    refreshCurrentItems,
    addItem,
    removeItem,
    fetchAllTracked,
  }
})
