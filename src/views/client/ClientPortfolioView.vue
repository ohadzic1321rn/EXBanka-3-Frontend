<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useMarketStore } from '../../stores/market'
import { clientPortfolioApi } from '../../api/portfolio'
import type { Holding } from '../../api/portfolio'
import BuyOrderModal from '../../components/BuyOrderModal.vue'
import type { ListingItem } from '../../api/market'

const marketStore = useMarketStore()

// Rich holdings from the new endpoint (for sell buttons)
const holdings = ref<Holding[]>([])
const holdingsLoading = ref(false)

// Sell modal state
const sellModalHolding = ref<Holding | null>(null)

const holdingsCount = computed(() => holdings.value.length || marketStore.portfolio?.items.length || 0)

const sortedHoldings = computed(() =>
  [...holdings.value].sort((a, b) => b.marketValue - a.marketValue || a.assetTicker.localeCompare(b.assetTicker))
)

const totalValue = computed(() => holdings.value.reduce((s, h) => s + h.marketValue, 0))
const totalUnrealizedPnL = computed(() => holdings.value.reduce((s, h) => s + h.unrealizedPnL, 0))
const totalRealizedProfit = computed(() => holdings.value.reduce((s, h) => s + h.realizedProfit, 0))

const concentrationRatio = computed(() => {
  const top = sortedHoldings.value[0]
  if (!totalValue.value || !top) return 0
  return (top.marketValue / totalValue.value) * 100
})

const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function formatAmount(value: number) { return formatter.format(value) }

function positionShare(marketValue: number) {
  if (!totalValue.value) return 0
  return (marketValue / totalValue.value) * 100
}

// Build a minimal ListingItem from holding data to pass to BuyOrderModal
function holdingToListing(h: Holding): ListingItem {
  return {
    ticker: h.assetTicker,
    name: h.assetName,
    exchange: { name: h.exchange, acronym: h.exchange, micCode: '', currency: h.currency },
    lastRefresh: h.createdAt,
    price: h.currentPrice,
    ask: h.currentPrice,
    bid: h.currentPrice,
    volume: 0,
    type: h.assetType,
  }
}

function openSell(h: Holding) {
  sellModalHolding.value = h
}

function onSellSubmitted() {
  sellModalHolding.value = null
  loadHoldings()
}

async function loadHoldings() {
  holdingsLoading.value = true
  try {
    const res = await clientPortfolioApi.listHoldings()
    holdings.value = res.data.holdings ?? []
  } catch {
    holdings.value = []
  } finally {
    holdingsLoading.value = false
  }
}

onMounted(async () => {
  await loadHoldings()
  await marketStore.fetchPortfolio()
})
</script>

<template>
  <div class="portfolio-page">
    <div class="page-header">
      <div>
        <h1>Portfolio</h1>
        <p>Read-only pregled pozicija zasnovan na trenutnim market podacima iz Sprint 4 foundation sloja.</p>
      </div>
      <RouterLink to="/client/securities" class="secondary-link">Nazad na hartije</RouterLink>
    </div>

    <div v-if="holdingsLoading" class="empty-state">Ucitavam portfolio...</div>
    <div v-else-if="!holdings.length && !holdingsLoading" class="empty-state">Portfolio trenutno nema aktivnih pozicija.</div>
    <template v-else>
      <div class="summary-grid">
        <article class="summary-card primary">
          <span>Ukupna procenjena vrednost</span>
          <strong>{{ formatAmount(totalValue) }}</strong>
        </article>
        <article class="summary-card">
          <span>Nerealizovani P/L</span>
          <strong :class="{ positive: totalUnrealizedPnL >= 0, negative: totalUnrealizedPnL < 0 }">
            {{ formatAmount(totalUnrealizedPnL) }}
          </strong>
        </article>
        <article class="summary-card">
          <span>Realizovani profit</span>
          <strong :class="{ positive: totalRealizedProfit >= 0, negative: totalRealizedProfit < 0 }">
            {{ formatAmount(totalRealizedProfit) }}
          </strong>
        </article>
        <article class="summary-card">
          <span>Najveca pozicija</span>
          <strong>{{ concentrationRatio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}%</strong>
        </article>
      </div>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Pozicije</h2>
            <span class="panel-meta">Sortirano po procenjenoj vrednosti, najvece prvo.</span>
          </div>
          <span class="panel-meta">{{ holdingsCount }} pozicija</span>
        </div>

        <div v-if="sortedHoldings.length === 0" class="empty-inline">Portfolio trenutno nema prikazane pozicije.</div>
        <div v-else class="table-wrap">
          <table class="portfolio-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Naziv</th>
                <th>Tip</th>
                <th>Kolicina</th>
                <th>Avg price</th>
                <th>Current price</th>
                <th>Market value</th>
                <th>P/L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in sortedHoldings" :key="item.id">
                <td class="ticker">
                  <RouterLink :to="`/client/securities/${item.assetTicker}`">{{ item.assetTicker }}</RouterLink>
                </td>
                <td>
                  <div class="asset-name">{{ item.assetName }}</div>
                  <div class="asset-meta">{{ item.exchange }} | {{ item.currency }}</div>
                </td>
                <td><span class="type-badge">{{ item.assetType }}</span></td>
                <td>{{ item.quantity.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }}</td>
                <td>{{ formatAmount(item.avgBuyPrice) }}</td>
                <td>{{ formatAmount(item.currentPrice) }}</td>
                <td>{{ formatAmount(item.marketValue) }}</td>
                <td>
                  <div :class="{ positive: item.unrealizedPnL >= 0, negative: item.unrealizedPnL < 0 }">
                    {{ formatAmount(item.unrealizedPnL) }}
                  </div>
                  <div class="asset-meta">{{ item.unrealizedPnLPct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}%</div>
                </td>
                <td>
                  <button class="sell-btn" @click="openSell(item)">Prodaj</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Sell modal -->
      <BuyOrderModal
        v-if="sellModalHolding"
        :listing="holdingToListing(sellModalHolding)"
        user-type="client"
        direction="sell"
        :max-quantity="Math.floor(sellModalHolding.quantity)"
        :preselected-account-id="sellModalHolding.accountId"
        @close="sellModalHolding = null"
        @submitted="onSellSubmitted"
      />
    </template>
  </div>
</template>

<style scoped>
.portfolio-page {
  padding: 32px;
  max-width: 1220px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 30px;
  color: #0f172a;
}

.page-header p {
  margin: 8px 0 0;
  color: #64748b;
}

.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #cbd5e1;
  color: #0f172a;
  text-decoration: none;
  font-weight: 600;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.summary-card.primary {
  background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%);
  color: #fff;
  border: none;
}

.summary-card span {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.summary-card.primary span {
  color: rgba(255, 255, 255, 0.72);
}

.summary-card strong {
  display: block;
  margin-top: 10px;
  font-size: 24px;
  color: #0f172a;
}

.summary-card.primary strong {
  color: #fff;
}

.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-head h2 {
  margin: 0;
  color: #0f172a;
}

.panel-meta {
  font-size: 13px;
  color: #64748b;
}

.table-wrap {
  overflow-x: auto;
}

.portfolio-table {
  width: 100%;
  border-collapse: collapse;
}

.portfolio-table th,
.portfolio-table td {
  padding: 14px 12px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}

.portfolio-table th {
  font-size: 12px;
  text-transform: uppercase;
  color: #64748b;
}

.ticker a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 700;
}

.asset-name {
  font-weight: 600;
  color: #0f172a;
}

.asset-meta {
  font-size: 12px;
  color: #64748b;
}

.positive { color: #15803d; font-weight: 700; }
.negative { color: #b91c1c; font-weight: 700; }

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sell-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  background: #dc2626;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.sell-btn:hover { background: #b91c1c; }

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

.empty-inline {
  padding: 22px;
  border-radius: 12px;
  background: #f8fafc;
  color: #64748b;
  text-align: center;
}

@media (max-width: 960px) {
  .page-header,
  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
