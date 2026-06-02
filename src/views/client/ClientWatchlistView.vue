<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useWatchlistStore } from '../../stores/watchlist'
import { marketApi } from '../../api/market'
import type { ListingItem } from '../../api/market'
import BuyOrderModal from '../../components/BuyOrderModal.vue'

const watchlistStore = useWatchlistStore()

// --- Filter ---
const typeFilter = ref('')
const tickerInput = ref('')
const addError = ref('')
const addLoading = ref(false)

// --- Create watchlist ---
const newListName = ref('')
const createError = ref('')
const createLoading = ref(false)
const showCreateForm = ref(false)

// --- Buy modal ---
const showBuyModal = ref(false)
const buyListing = ref<ListingItem | null>(null)
const buyLoading = ref(false)
const buyError = ref('')

// --- Polling ---
const POLL_INTERVAL_MS = 30_000
let pollTimer: ReturnType<typeof setInterval> | null = null

// --- Computed ---
const filteredItems = computed(() => {
  const items = watchlistStore.currentItems
  if (!typeFilter.value) return items
  return items.filter((i) => i.type === typeFilter.value)
})

const availableTypes = computed(() => {
  const types = new Set(watchlistStore.currentItems.map((i) => i.type))
  return Array.from(types).sort()
})

// --- Lifecycle ---
onMounted(async () => {
  await watchlistStore.fetchWatchlists()
  if (watchlistStore.currentWatchlistId !== null) {
    await watchlistStore.fetchItems(watchlistStore.currentWatchlistId)
  }
  pollTimer = setInterval(async () => {
    await watchlistStore.refreshCurrentItems()
  }, POLL_INTERVAL_MS)
})

onUnmounted(() => {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

// --- Actions ---
async function selectList(id: number) {
  typeFilter.value = ''
  tickerInput.value = ''
  addError.value = ''
  await watchlistStore.selectWatchlist(id)
}

async function createList() {
  const name = newListName.value.trim()
  if (!name) return
  createLoading.value = true
  createError.value = ''
  try {
    await watchlistStore.createWatchlist(name)
    newListName.value = ''
    showCreateForm.value = false
    if (watchlistStore.currentWatchlistId !== null) {
      await watchlistStore.fetchItems(watchlistStore.currentWatchlistId)
    }
  } catch (e: any) {
    createError.value = e?.response?.data?.message ?? 'Greška pri kreiranju liste.'
  } finally {
    createLoading.value = false
  }
}

async function deleteCurrentList() {
  if (watchlistStore.currentWatchlistId === null) return
  if (!confirm('Obrisati ovu watchlistu i sve njene stavke?')) return
  try {
    await watchlistStore.deleteWatchlist(watchlistStore.currentWatchlistId)
    if (watchlistStore.currentWatchlistId !== null) {
      await watchlistStore.fetchItems(watchlistStore.currentWatchlistId)
    } else {
      watchlistStore.currentItems.length = 0
    }
  } catch (e: any) {
    watchlistStore.error = e?.response?.data?.message ?? 'Greška pri brisanju liste.'
  }
}

async function addTicker() {
  const ticker = tickerInput.value.trim().toUpperCase()
  if (!ticker) return
  addLoading.value = true
  addError.value = ''
  try {
    await watchlistStore.addItem(ticker)
    tickerInput.value = ''
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 409) {
      addError.value = `${ticker} je već na ovoj listi.`
    } else if (status === 400) {
      addError.value = `Ticker "${ticker}" ne postoji na berzi.`
    } else {
      addError.value = e?.response?.data?.message ?? 'Greška pri dodavanju.'
    }
  } finally {
    addLoading.value = false
  }
}

async function removeTicker(ticker: string) {
  try {
    await watchlistStore.removeItem(ticker)
  } catch (e: any) {
    watchlistStore.itemsError = e?.response?.data?.message ?? 'Greška pri uklanjanju.'
  }
}

async function openBuyModal(ticker: string) {
  buyLoading.value = true
  buyError.value = ''
  buyListing.value = null
  try {
    const res = await marketApi.getListing(ticker)
    buyListing.value = res.data.listing
    showBuyModal.value = true
  } catch {
    buyError.value = 'Nije moguće učitati podatke o hartiji.'
  } finally {
    buyLoading.value = false
  }
}

function closeBuyModal() {
  showBuyModal.value = false
  buyListing.value = null
}

function fmtPrice(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtChange(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}
</script>

<template>
  <div class="wl-page">
    <div class="wl-header">
      <h1>Moje watchliste</h1>
      <button class="btn-outline" @click="showCreateForm = !showCreateForm">
        {{ showCreateForm ? 'Odustani' : '+ Nova lista' }}
      </button>
    </div>

    <!-- Create form -->
    <div v-if="showCreateForm" class="create-form">
      <input
        v-model="newListName"
        class="text-input"
        placeholder="Naziv liste"
        maxlength="80"
        @keyup.enter="createList"
      />
      <button class="btn-primary" :disabled="createLoading || !newListName.trim()" @click="createList">
        {{ createLoading ? 'Kreiranje...' : 'Kreiraj' }}
      </button>
      <span v-if="createError" class="error-msg">{{ createError }}</span>
    </div>

    <div v-if="watchlistStore.loading" class="loading-state">Učitavam liste...</div>
    <div v-else-if="watchlistStore.error" class="error-box">{{ watchlistStore.error }}</div>
    <div v-else-if="watchlistStore.watchlists.length === 0" class="empty-state">
      <p>Nemate nijednu watchlistu. Kreirajte prvu listu klikom na "+ Nova lista".</p>
    </div>

    <template v-else>
      <!-- Watchlist tabs -->
      <div class="wl-tabs">
        <button
          v-for="wl in watchlistStore.watchlists"
          :key="wl.id"
          class="wl-tab"
          :class="{ active: watchlistStore.currentWatchlistId === wl.id }"
          @click="selectList(wl.id)"
        >
          {{ wl.name }}
        </button>
      </div>

      <!-- Current watchlist toolbar -->
      <div v-if="watchlistStore.currentWatchlistId !== null" class="wl-toolbar">
        <div class="add-ticker-row">
          <input
            v-model="tickerInput"
            class="text-input ticker-input"
            placeholder="Ticker (npr. AAPL)"
            @keyup.enter="addTicker"
          />
          <button class="btn-primary" :disabled="addLoading || !tickerInput.trim()" @click="addTicker">
            {{ addLoading ? '...' : 'Dodaj' }}
          </button>
          <span v-if="addError" class="error-msg">{{ addError }}</span>
        </div>

        <div class="toolbar-right">
          <select v-if="availableTypes.length > 0" v-model="typeFilter" class="type-select">
            <option value="">Svi tipovi</option>
            <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
          </select>
          <button class="btn-danger-outline" @click="deleteCurrentList">Obriši listu</button>
        </div>
      </div>

      <!-- Items table -->
      <div v-if="watchlistStore.itemsLoading" class="loading-state">Učitavam stavke...</div>
      <div v-else-if="watchlistStore.itemsError" class="error-box">{{ watchlistStore.itemsError }}</div>
      <div v-else-if="watchlistStore.currentItems.length === 0" class="empty-state">
        <p>Lista je prazna. Dodajte hartije koristeći polje za ticker iznad.</p>
      </div>
      <div v-else-if="filteredItems.length === 0" class="empty-state">
        <p>Nema hartija za odabrani filter.</p>
      </div>
      <div v-else class="table-wrap">
        <table class="items-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Naziv</th>
              <th>Tip</th>
              <th class="num-col">Cena</th>
              <th class="num-col">Promena</th>
              <th class="num-col">Volume</th>
              <th class="actions-col">Akcije</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.ticker">
              <td class="ticker-cell">{{ item.ticker }}</td>
              <td>{{ item.name }}</td>
              <td><span class="type-badge">{{ item.type }}</span></td>
              <td class="num-col">{{ fmtPrice(item.price) }}</td>
              <td
                class="num-col"
                :class="item.change >= 0 ? 'positive' : 'negative'"
              >{{ fmtChange(item.change) }}</td>
              <td class="num-col">{{ item.volume.toLocaleString('en-US') }}</td>
              <td class="actions-col">
                <button
                  class="btn-buy"
                  :disabled="buyLoading"
                  @click="openBuyModal(item.ticker)"
                >Kupi</button>
                <button class="btn-remove" @click="removeTicker(item.ticker)">Ukloni</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="buyError" class="error-msg" style="margin-top:8px">{{ buyError }}</p>
      </div>
    </template>

    <!-- Buy modal -->
    <BuyOrderModal
      v-if="showBuyModal && buyListing !== null"
      :listing="buyListing"
      user-type="client"
      @close="closeBuyModal"
      @submitted="closeBuyModal"
    />
  </div>
</template>

<style scoped>
.wl-page {
  padding: 32px;
  max-width: 1100px;
  margin: 0 auto;
}

.wl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.wl-header h1 {
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.create-form {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.wl-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 0;
  border-bottom: 2px solid #e2e8f0;
}

.wl-tab {
  padding: 10px 20px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
}
.wl-tab:hover { color: #1e293b; }
.wl-tab.active { color: #2563eb; border-bottom-color: #2563eb; font-weight: 600; }

.wl-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  flex-wrap: wrap;
}

.add-ticker-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.text-input {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.text-input:focus { border-color: #3b82f6; }

.ticker-input { width: 180px; }

.type-select {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
}

.btn-primary {
  padding: 8px 18px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-outline {
  padding: 8px 18px;
  background: transparent;
  color: #2563eb;
  border: 1px solid #2563eb;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-outline:hover { background: #eff6ff; }

.btn-danger-outline {
  padding: 8px 14px;
  background: transparent;
  color: #dc2626;
  border: 1px solid #dc2626;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-danger-outline:hover { background: #fef2f2; }

.table-wrap {
  overflow-x: auto;
  margin-top: 4px;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.items-table th {
  background: #f8fafc;
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
}

.items-table td {
  padding: 13px 16px;
  font-size: 14px;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
}

.items-table tbody tr:last-child td { border-bottom: none; }
.items-table tbody tr:hover td { background: #f8fafc; }

.num-col { text-align: right; }
.actions-col { text-align: right; white-space: nowrap; }

.ticker-cell {
  font-weight: 700;
  color: #2563eb;
  font-family: monospace;
  font-size: 14px;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.positive { color: #16a34a; font-weight: 600; }
.negative { color: #dc2626; font-weight: 600; }

.btn-buy {
  padding: 5px 14px;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-right: 6px;
  transition: background 0.15s;
}
.btn-buy:hover:not(:disabled) { background: #15803d; }
.btn-buy:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-remove {
  padding: 5px 12px;
  background: transparent;
  color: #dc2626;
  border: 1px solid #dc2626;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-remove:hover { background: #fef2f2; }

.loading-state {
  text-align: center;
  padding: 40px;
  color: #64748b;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #64748b;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-top: 4px;
}

.error-box {
  padding: 14px 18px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #991b1b;
  font-size: 14px;
  margin-top: 4px;
}

.error-msg {
  color: #dc2626;
  font-size: 13px;
}
</style>
