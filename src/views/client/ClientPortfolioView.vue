<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useClientPortfolioStore } from '../../stores/portfolio'
import { useClientAuthStore } from '../../stores/clientAuth'
import { clientPortfolioApi, type Holding } from '../../api/portfolio'
import { clientTaxApi, type TaxSummary } from '../../api/tax'
import BuyOrderModal from '../../components/BuyOrderModal.vue'
import type { ListingItem } from '../../api/market'

const portfolioStore = useClientPortfolioStore()
const authStore = useClientAuthStore()

const sellModalHolding = ref<Holding | null>(null)

// OTC toggle
const togglingPublic = ref<Set<number>>(new Set())

async function togglePublic(h: Holding) {
  togglingPublic.value.add(h.id)
  try {
    await clientPortfolioApi.setPublic(h.id, !h.isPublic)
    await portfolioStore.fetchAll()
  } finally {
    togglingPublic.value.delete(h.id)
  }
}

// Tax section
const taxSummary = ref<TaxSummary | null>(null)
const taxError = ref('')

const currentPeriod = new Date().toISOString().slice(0, 7) // YYYY-MM

async function fetchTaxSummary() {
  const userId = Number(authStore.client?.id)
  if (!userId) return
  try {
    const res = await clientTaxApi.getSummary(userId, currentPeriod)
    taxSummary.value = res.data
  } catch {
    taxError.value = 'Nije moguće učitati porezne podatke.'
  }
}

const sortedHoldings = computed(() =>
  [...portfolioStore.holdings].sort((a, b) => b.marketValue - a.marketValue || a.assetTicker.localeCompare(b.assetTicker))
)

const concentrationRatio = computed(() => {
  const top = sortedHoldings.value[0]
  if (!portfolioStore.totalValue || !top) return 0
  return (top.marketValue / portfolioStore.totalValue) * 100
})

const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function formatAmount(value: number) { return formatter.format(value) }


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

function openSell(h: Holding) { sellModalHolding.value = h }

function onSellSubmitted() {
  sellModalHolding.value = null
  portfolioStore.fetchAll()
}

onMounted(() => {
  portfolioStore.fetchAll()
  fetchTaxSummary()
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

    <div v-if="portfolioStore.loading" class="empty-state">Ucitavam portfolio...</div>
    <div v-else-if="portfolioStore.error" class="error-box">{{ portfolioStore.error }}</div>
    <div v-else-if="!portfolioStore.holdings.length" class="empty-state">Portfolio trenutno nema aktivnih pozicija.</div>
    <template v-else>
      <div class="summary-grid">
        <article class="summary-card primary">
          <span>Ukupna procenjena vrednost</span>
          <strong>{{ formatAmount(portfolioStore.totalValue) }}</strong>
        </article>
        <article class="summary-card">
          <span>Nerealizovani P/L</span>
          <strong :class="{ positive: portfolioStore.totalUnrealizedPnL >= 0, negative: portfolioStore.totalUnrealizedPnL < 0 }">
            {{ formatAmount(portfolioStore.totalUnrealizedPnL) }}
          </strong>
        </article>
        <article class="summary-card">
          <span>Realizovani profit</span>
          <strong :class="{ positive: portfolioStore.totalRealizedProfit >= 0, negative: portfolioStore.totalRealizedProfit < 0 }">
            {{ formatAmount(portfolioStore.totalRealizedProfit) }}
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
          <span class="panel-meta">{{ portfolioStore.holdings.length }} pozicija</span>
        </div>

        <div v-if="sortedHoldings.length === 0" class="empty-inline">Nema pozicija za prikaz.</div>
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
                <td class="action-cell">
                  <button
                    v-if="item.assetType === 'stock'"
                    class="otc-btn"
                    :class="{ 'otc-active': item.isPublic }"
                    :disabled="togglingPublic.has(item.id)"
                    @click="togglePublic(item)"
                    :title="item.isPublic ? 'OTC: javno — klikni da ukloniš' : 'OTC: privatno — klikni da objaviš'"
                  >{{ item.isPublic ? 'OTC ✓' : 'OTC' }}</button>
                  <button class="sell-btn" @click="openSell(item)">Prodaj</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tax section -->
      <section class="panel tax-panel">
        <div class="panel-head">
          <h2>Porez na kapitalnu dobit</h2>
        </div>
        <div v-if="taxError" class="error-box" style="margin:0">{{ taxError }}</div>
        <div v-else-if="!taxSummary" class="empty-inline">Učitavam porezne podatke...</div>
        <div v-else class="tax-grid">
          <div class="tax-card">
            <span>Neplaćeni porez ({{ currentPeriod }})</span>
            <strong :class="{ negative: taxSummary.total_unpaid > 0 }">
              {{ formatAmount(taxSummary.total_unpaid) }} RSD
            </strong>
          </div>
          <div class="tax-card">
            <span>Plaćeno ove godine</span>
            <strong>{{ formatAmount(taxSummary.paid_this_year) }} RSD</strong>
          </div>
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

.tax-panel {
  margin-top: 24px;
}

.tax-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.tax-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 20px;
}

.tax-card span {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.tax-card strong {
  display: block;
  margin-top: 8px;
  font-size: 20px;
  color: #0f172a;
}

.otc-btn {
  padding: 4px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #f8fafc;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  margin-right: 6px;
}

.otc-btn.otc-active {
  background: #dcfce7;
  border-color: #86efac;
  color: #15803d;
}

.otc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-cell { white-space: nowrap; }
</style>
