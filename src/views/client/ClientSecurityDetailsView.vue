<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useMarketStore } from '../../stores/market'
import { marketApi } from '../../api/market'
import type { OptionItem } from '../../api/market'
import PriceChart from '../../components/PriceChart.vue'
import BuyOrderModal from '../../components/BuyOrderModal.vue'

type Period = '1D' | '1W' | '1M' | '3M' | '1Y' | 'Max'
const PERIODS: Period[] = ['1D', '1W', '1M', '3M', '1Y', 'Max']

const route = useRoute()
const marketStore = useMarketStore()
const chartPeriod = ref<Period>('1M')
const refreshing = ref(false)

// Options chain state
const allOptions = ref<OptionItem[]>([])
const optionsLoading = ref(false)
const selectedExpiry = ref('')
const strikeFilter = ref<'all' | 'itm' | 'otm'>('all')
const stockPriceForOptions = ref(0)

const priceFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const volumeFormatter = new Intl.NumberFormat('en-US')

const ticker = computed(() => String(route.params.ticker || '').trim().toUpperCase())

const historyRows = computed(() =>
  [...marketStore.currentHistory].sort((left, right) => right.date.localeCompare(left.date))
)

const latestHistoryPoint = computed(() => historyRows.value[0] ?? null)

const historyHigh = computed(() => {
  if (historyRows.value.length === 0) return null
  return Math.max(...historyRows.value.map((point) => point.high))
})

const historyLow = computed(() => {
  if (historyRows.value.length === 0) return null
  return Math.min(...historyRows.value.map((point) => point.low))
})

const historyAverage = computed(() => {
  if (historyRows.value.length === 0) return null
  const total = historyRows.value.reduce((sum, point) => sum + point.price, 0)
  return total / historyRows.value.length
})

function formatPrice(value: number | null | undefined) {
  if (value == null) return 'N/A'
  return priceFormatter.format(value)
}

async function loadDetails() {
  if (!ticker.value) return
  await marketStore.fetchListingDetails(ticker.value)
}

async function refresh() {
  refreshing.value = true
  await loadDetails()
  refreshing.value = false
}

async function loadOptions() {
  if (!ticker.value || marketStore.currentListing?.type !== 'stock') return
  optionsLoading.value = true
  try {
    const res = await marketApi.getOptionsChain(ticker.value)
    allOptions.value = res.data.options ?? []
    stockPriceForOptions.value = res.data.stockPrice
    // Default to nearest expiry
    if (expiryDates.value.length > 0 && !selectedExpiry.value) {
      selectedExpiry.value = expiryDates.value[0] ?? ''
    }
  } catch {
    allOptions.value = []
  } finally {
    optionsLoading.value = false
  }
}

const expiryDates = computed(() => {
  const dates = new Set<string>(allOptions.value.map((o) => o.settlementDate))
  return Array.from(dates).sort()
})

const filteredOptions = computed(() => {
  const spot = stockPriceForOptions.value
  return allOptions.value.filter((o) => {
    if (selectedExpiry.value && o.settlementDate !== selectedExpiry.value) return false
    if (strikeFilter.value === 'itm') {
      return (o.optionType === 'CALL' && o.strikePrice < spot) ||
             (o.optionType === 'PUT' && o.strikePrice > spot)
    }
    if (strikeFilter.value === 'otm') {
      return (o.optionType === 'CALL' && o.strikePrice > spot) ||
             (o.optionType === 'PUT' && o.strikePrice < spot)
    }
    return true
  })
})

// Group options by strike for the CALLS | Strike | PUTS layout
const chainRows = computed(() => {
  const byStrike = new Map<number, { call?: OptionItem; put?: OptionItem }>()
  for (const opt of filteredOptions.value) {
    const row = byStrike.get(opt.strikePrice) ?? {}
    if (opt.optionType === 'CALL') row.call = opt
    else row.put = opt
    byStrike.set(opt.strikePrice, row)
  }
  return Array.from(byStrike.entries())
    .sort(([a], [b]) => a - b)
    .map(([strike, sides]) => ({ strike, call: sides.call, put: sides.put }))
})

function isItm(type: 'CALL' | 'PUT', strike: number): boolean {
  const spot = stockPriceForOptions.value
  return type === 'CALL' ? strike < spot : strike > spot
}

onMounted(async () => {
  await loadDetails()
  await loadOptions()
})
watch(ticker, async () => {
  await loadDetails()
  allOptions.value = []
  selectedExpiry.value = ''
  await loadOptions()
})

const showBuyModal = ref(false)

function onOrderSubmitted() {
  showBuyModal.value = false
}
</script>

<template>
  <div class="details-page">
    <RouterLink to="/client/securities" class="back-link">Nazad na hartije</RouterLink>

    <div v-if="!ticker" class="empty-state">
      <h2>Nedostaje ticker</h2>
      <p>Izaberite hartiju sa liste kako biste videli detalje.</p>
      <RouterLink to="/client/securities" class="action-link">Nazad na listu</RouterLink>
    </div>
    <div v-else-if="marketStore.detailsLoading" class="empty-state">Ucitavam detalje hartije...</div>
    <div v-else-if="marketStore.error" class="error-box">
      <h2>Detalji nisu dostupni</h2>
      <p>{{ marketStore.error }}</p>
      <RouterLink to="/client/securities" class="action-link action-link-light">Povratak na listu</RouterLink>
    </div>
    <div v-else-if="!marketStore.currentListing" class="empty-state">
      <h2>Hartija nije pronadjena</h2>
      <p>Ticker {{ ticker }} trenutno nema dostupne podatke.</p>
      <RouterLink to="/client/securities" class="action-link">Nazad na listu</RouterLink>
    </div>
    <template v-else>
      <div class="hero">
        <div>
          <div class="ticker-pill">{{ marketStore.currentListing.ticker }}</div>
          <h1>{{ marketStore.currentListing.name }}</h1>
          <p>{{ marketStore.currentListing.exchange.name }} | {{ marketStore.currentListing.exchange.currency }}</p>
        </div>
        <div class="hero-right">
          <div class="hero-price">
            {{ formatPrice(marketStore.currentListing.price) }}
            <span>{{ marketStore.currentListing.exchange.currency }}</span>
          </div>
          <button class="buy-btn" @click="showBuyModal = true">Kupi</button>
        </div>
      </div>

      <BuyOrderModal
        v-if="showBuyModal"
        :listing="marketStore.currentListing"
        user-type="client"
        @close="showBuyModal = false"
        @submitted="onOrderSubmitted"
      />

      <div class="stats-grid">
        <div class="stat-card">
          <span>Ask</span>
          <strong>{{ formatPrice(marketStore.currentListing.ask) }}</strong>
        </div>
        <div class="stat-card">
          <span>Bid</span>
          <strong>{{ formatPrice(marketStore.currentListing.bid) }}</strong>
        </div>
        <div class="stat-card">
          <span>Volume</span>
          <strong>{{ volumeFormatter.format(marketStore.currentListing.volume) }}</strong>
        </div>
        <div class="stat-card">
          <span>Last refresh</span>
          <strong>{{ new Date(marketStore.currentListing.lastRefresh).toLocaleString('sr-RS') }}</strong>
        </div>
      </div>

      <div class="summary-grid">
        <article class="summary-card">
          <span>30d high</span>
          <strong>{{ formatPrice(historyHigh) }}</strong>
        </article>
        <article class="summary-card">
          <span>30d low</span>
          <strong>{{ formatPrice(historyLow) }}</strong>
        </article>
        <article class="summary-card">
          <span>30d avg</span>
          <strong>{{ formatPrice(historyAverage) }}</strong>
        </article>
        <article class="summary-card">
          <span>Poslednja promena</span>
          <strong :class="{ positive: (latestHistoryPoint?.change ?? 0) >= 0, negative: (latestHistoryPoint?.change ?? 0) < 0 }">
            {{ latestHistoryPoint ? formatPrice(latestHistoryPoint.change) : 'N/A' }}
          </strong>
        </article>
      </div>

      <section class="panel info-panel">
        <div class="panel-head">
          <h2>Osnovni podaci</h2>
        </div>
        <ul class="meta-list">
          <li><span>Naziv</span><strong>{{ marketStore.currentListing.name }}</strong></li>
          <li><span>Berza</span><strong>{{ marketStore.currentListing.exchange.acronym }}</strong></li>
          <li><span>MIC</span><strong>{{ marketStore.currentListing.exchange.micCode }}</strong></li>
          <li><span>Tip</span><strong>{{ marketStore.currentListing.type }}</strong></li>
          <li><span>Valuta</span><strong>{{ marketStore.currentListing.exchange.currency }}</strong></li>
          <li><span>Trziste</span><strong>{{ marketStore.currentListing.exchange.name }}</strong></li>
        </ul>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Graf kretanja cene</h2>
          <div class="chart-controls">
            <div class="period-bar">
              <button
                v-for="p in PERIODS"
                :key="p"
                :class="['period-btn', { active: chartPeriod === p }]"
                @click="chartPeriod = p"
              >{{ p }}</button>
            </div>
            <button class="refresh-btn" :disabled="refreshing" @click="refresh">
              {{ refreshing ? '...' : 'Osvezi' }}
            </button>
          </div>
        </div>
        <PriceChart
          :history="marketStore.currentHistory"
          :period="chartPeriod"
          :currency="marketStore.currentListing!.exchange.currency ?? ''"
        />
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Istorija kretanja cene</h2>
          <span>{{ historyRows.length }} dana, najnovije prvo</span>
        </div>

        <div v-if="historyRows.length === 0" class="empty-inline">Istorija trenutno nije dostupna.</div>
        <div v-else class="table-wrap">
          <table class="history-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Cena</th>
                <th>High</th>
                <th>Low</th>
                <th>Promena</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in historyRows" :key="point.date">
                <td>{{ point.date }}</td>
                <td>{{ formatPrice(point.price) }}</td>
                <td>{{ formatPrice(point.high) }}</td>
                <td>{{ formatPrice(point.low) }}</td>
                <td :class="{ positive: point.change >= 0, negative: point.change < 0 }">
                  {{ formatPrice(point.change) }}
                </td>
                <td>{{ volumeFormatter.format(point.volume) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <!-- Options chain — only for stocks -->
      <section v-if="marketStore.currentListing.type === 'stock'" class="panel">
        <div class="panel-head">
          <h2>Opcioni lanac</h2>
          <div class="options-controls">
            <select v-model="selectedExpiry" class="expiry-select">
              <option value="">Sve expiry datumi</option>
              <option v-for="d in expiryDates" :key="d" :value="d">{{ d }}</option>
            </select>
            <div class="strike-filter-bar">
              <button :class="['sf-btn', { active: strikeFilter === 'all' }]" @click="strikeFilter = 'all'">Sve</button>
              <button :class="['sf-btn', { active: strikeFilter === 'itm' }]" @click="strikeFilter = 'itm'">ITM</button>
              <button :class="['sf-btn', { active: strikeFilter === 'otm' }]" @click="strikeFilter = 'otm'">OTM</button>
            </div>
          </div>
        </div>
        <div v-if="optionsLoading" class="empty-inline">Ucitavam opcije...</div>
        <div v-else-if="allOptions.length === 0" class="empty-inline">Opcioni podaci nisu dostupni.</div>
        <div v-else-if="chainRows.length === 0" class="empty-inline">Nema opcija za odabrane filtere.</div>
        <div v-else class="table-wrap">
          <table class="options-table">
            <thead>
              <tr>
                <th colspan="4" class="calls-header">CALLS</th>
                <th class="strike-header">STRIKE</th>
                <th colspan="4" class="puts-header">PUTS</th>
              </tr>
              <tr>
                <th>Bid</th><th>Ask</th><th>IV</th><th>OI</th>
                <th></th>
                <th>Bid</th><th>Ask</th><th>IV</th><th>OI</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in chainRows" :key="row.strike">
                <!-- CALL side -->
                <template v-if="row.call">
                  <td :class="{ 'itm-cell': isItm('CALL', row.strike), 'otm-cell': !isItm('CALL', row.strike) }">
                    {{ formatPrice(row.call.bid) }}
                  </td>
                  <td :class="{ 'itm-cell': isItm('CALL', row.strike), 'otm-cell': !isItm('CALL', row.strike) }">
                    {{ formatPrice(row.call.ask) }}
                  </td>
                  <td :class="{ 'itm-cell': isItm('CALL', row.strike), 'otm-cell': !isItm('CALL', row.strike) }">
                    {{ (row.call.impliedVolatility * 100).toFixed(1) }}%
                  </td>
                  <td :class="{ 'itm-cell': isItm('CALL', row.strike), 'otm-cell': !isItm('CALL', row.strike) }">
                    {{ row.call.openInterest.toLocaleString('en-US') }}
                  </td>
                </template>
                <template v-else>
                  <td colspan="4" class="no-data-cell">—</td>
                </template>

                <!-- Strike -->
                <td class="strike-cell">{{ formatPrice(row.strike) }}</td>

                <!-- PUT side -->
                <template v-if="row.put">
                  <td :class="{ 'itm-cell': isItm('PUT', row.strike), 'otm-cell': !isItm('PUT', row.strike) }">
                    {{ formatPrice(row.put.bid) }}
                  </td>
                  <td :class="{ 'itm-cell': isItm('PUT', row.strike), 'otm-cell': !isItm('PUT', row.strike) }">
                    {{ formatPrice(row.put.ask) }}
                  </td>
                  <td :class="{ 'itm-cell': isItm('PUT', row.strike), 'otm-cell': !isItm('PUT', row.strike) }">
                    {{ (row.put.impliedVolatility * 100).toFixed(1) }}%
                  </td>
                  <td :class="{ 'itm-cell': isItm('PUT', row.strike), 'otm-cell': !isItm('PUT', row.strike) }">
                    {{ row.put.openInterest.toLocaleString('en-US') }}
                  </td>
                </template>
                <template v-else>
                  <td colspan="4" class="no-data-cell">—</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.details-page {
  padding: 32px;
  max-width: 1180px;
  margin: 0 auto;
}

.back-link {
  display: inline-block;
  margin-bottom: 18px;
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 22px;
}

.ticker-pill {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 10px 0 6px;
  font-size: 32px;
  color: #0f172a;
}

.hero p {
  margin: 0;
  color: #64748b;
}

.hero-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.hero-price {
  font-size: 42px;
  font-weight: 800;
  color: #0f172a;
  text-align: right;
}

.hero-price span {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
}

.buy-btn {
  padding: 12px 28px;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.buy-btn:hover { background: #15803d; }

.stats-grid,
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}

.stat-card,
.summary-card,
.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.stat-card,
.summary-card {
  padding: 18px;
}

.stat-card span,
.summary-card span {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.stat-card strong,
.summary-card strong {
  display: block;
  margin-top: 8px;
  font-size: 20px;
  color: #0f172a;
}

.panel {
  padding: 24px;
  margin-bottom: 24px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.panel-head h2 {
  margin: 0;
  color: #0f172a;
}

.meta-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.meta-list li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border-radius: 12px;
  background: #f8fafc;
}

.meta-list span {
  color: #64748b;
}

.meta-list strong {
  color: #0f172a;
  text-align: right;
}

.table-wrap {
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
}

.history-table th,
.history-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}

.history-table th {
  font-size: 12px;
  text-transform: uppercase;
  color: #64748b;
}

.positive {
  color: #15803d;
  font-weight: 700;
}

.negative {
  color: #b91c1c;
  font-weight: 700;
}

.empty-state,
.error-box {
  padding: 32px;
  border-radius: 16px;
  text-align: center;
}

.empty-state {
  background: #fff;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.error-box {
  background: #fef2f2;
  color: #b91c1c;
}

.empty-state h2,
.error-box h2 {
  margin: 0 0 10px;
  color: #0f172a;
}

.empty-state p,
.error-box p {
  margin: 0 0 18px;
}

.action-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  text-decoration: none;
  font-weight: 600;
}

.action-link-light {
  background: #b91c1c;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.period-bar {
  display: flex;
  gap: 4px;
}

.period-btn {
  padding: 6px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.period-btn:hover {
  background: #e2e8f0;
}

.period-btn.active {
  background: #0f172a;
  border-color: #0f172a;
  color: #fff;
}

.refresh-btn {
  padding: 6px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  background: #f1f5f9;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-inline {
  padding: 22px;
  border-radius: 12px;
  background: #f8fafc;
  color: #64748b;
  text-align: center;
}

.options-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.expiry-select {
  padding: 7px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  background: #fff;
}

.strike-filter-bar {
  display: flex;
  gap: 4px;
}

.sf-btn {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.sf-btn.active {
  background: #0f172a;
  border-color: #0f172a;
  color: #fff;
}

.options-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.options-table th,
.options-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #e2e8f0;
  text-align: center;
}

.options-table th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  background: #f8fafc;
}

.calls-header {
  background: #dcfce7 !important;
  color: #15803d !important;
  border-right: 2px solid #e2e8f0;
}

.puts-header {
  background: #fee2e2 !important;
  color: #b91c1c !important;
  border-left: 2px solid #e2e8f0;
}

.strike-header,
.strike-cell {
  background: #f1f5f9;
  font-weight: 700;
  color: #0f172a;
  border-left: 2px solid #e2e8f0;
  border-right: 2px solid #e2e8f0;
}

.itm-cell {
  background: rgba(22, 163, 74, 0.06);
  color: #15803d;
  font-weight: 600;
}

.otm-cell {
  color: #475569;
}

.no-data-cell {
  color: #cbd5e1;
}

@media (max-width: 900px) {
  .hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-grid,
  .summary-grid,
  .meta-list {
    grid-template-columns: 1fr;
  }
}
</style>
