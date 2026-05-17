<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useClientPortfolioStore } from '../../stores/portfolio'
import { useClientAuthStore } from '../../stores/clientAuth'
import { clientPortfolioApi, type Holding } from '../../api/portfolio'
import { clientTaxApi, type TaxSummary } from '../../api/tax'
import { clientOrderApi, type Order } from '../../api/order'
import { clientAccountApi, type ClientAccountItem } from '../../api/clientAccount'
import BuyOrderModal from '../../components/BuyOrderModal.vue'
import type { ListingItem } from '../../api/market'

const portfolioStore = useClientPortfolioStore()
const authStore = useClientAuthStore()

const sellModalHolding = ref<Holding | null>(null)

// OTC public quantity foundation for Sprint 6.
const otcModalHolding = ref<Holding | null>(null)
const otcPublicQuantity = ref('')
const otcError = ref('')
const otcSuccess = ref('')
const savingOtcQuantity = ref(false)

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

// Buy-order history section
const buyOrders = ref<Order[]>([])
const buyOrdersError = ref('')
const accountsById = ref<Record<string, ClientAccountItem>>({})

async function fetchBuyOrders() {
  try {
    const res = await clientOrderApi.listOrders()
    buyOrders.value = (res.data.orders || []).filter((o) => o.direction === 'buy')
  } catch {
    buyOrdersError.value = 'Nije moguće učitati istoriju kupovina.'
  }
}

async function fetchClientAccountsForOrders() {
  const clientId = authStore.client?.id
  if (!clientId) return
  try {
    const res: any = await clientAccountApi.listByClient(String(clientId))
    const items: ClientAccountItem[] = res.data?.accounts || res.data?.content || res.data || []
    const map: Record<string, ClientAccountItem> = {}
    for (const a of items) map[String(a.id)] = a
    accountsById.value = map
  } catch {
    // best effort — table falls back to showing the raw account id
  }
}

const sortedBuyOrders = computed(() =>
  [...buyOrders.value].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ),
)

const marginOrders = computed(() =>
  sortedBuyOrders.value.filter((o) => o.isMargin),
)

function bankLoanAccountLabel(o: Order) {
  const acc = accountsById.value[String(o.accountId)]
  const currency = acc?.currencyKod || '—'
  return `EXBanka — ${currency}`
}

function accountLabel(accountId: number) {
  const acc = accountsById.value[String(accountId)]
  if (!acc) return `#${accountId}`
  return `${acc.naziv} (${acc.brojRacuna})`
}

function orderTypeLabel(t: string) {
  const map: Record<string, string> = {
    market: 'Market',
    limit: 'Limit',
    stop: 'Stop',
    stop_limit: 'Stop-Limit',
  }
  return map[t] || t
}

function formatOrderDate(iso: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

function formatQuantity(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function getPublicQuantity(h: Holding) {
  return h.publicQuantity ?? (h.isPublic ? h.quantity : 0)
}

function getReservedQuantity(h: Holding) {
  return h.reservedQuantity ?? 0
}

function getAvailableForOtc(h: Holding) {
  return h.availableForOtc ?? Math.max(getPublicQuantity(h) - getReservedQuantity(h), 0)
}


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

function openOtcModal(h: Holding) {
  otcModalHolding.value = h
  otcPublicQuantity.value = String(getPublicQuantity(h))
  otcError.value = ''
  otcSuccess.value = ''
}

function closeOtcModal() {
  otcModalHolding.value = null
  otcError.value = ''
}

function validateOtcQuantity(h: Holding) {
  const value = Number(otcPublicQuantity.value)
  const reserved = getReservedQuantity(h)
  if (!Number.isFinite(value) || value < 0) return 'OTC javna kolicina ne moze biti negativna.'
  if (value > h.quantity) return 'OTC javna kolicina ne moze biti veca od ukupne kolicine.'
  if (value < reserved) return 'OTC javna kolicina ne moze biti manja od vec rezervisane kolicine.'
  return ''
}

async function saveOtcQuantity() {
  const holding = otcModalHolding.value
  if (!holding) return

  const validationError = validateOtcQuantity(holding)
  if (validationError) {
    otcError.value = validationError
    return
  }

  savingOtcQuantity.value = true
  otcError.value = ''
  try {
    await clientPortfolioApi.setPublicQuantity(holding.id, Number(otcPublicQuantity.value))
    otcSuccess.value = `OTC javna kolicina za ${holding.assetTicker} je azurirana.`
    closeOtcModal()
    await portfolioStore.fetchAll()
  } catch (e: any) {
    otcError.value = e?.response?.data?.message || 'Nije moguce azurirati OTC javnu kolicinu.'
  } finally {
    savingOtcQuantity.value = false
  }
}

function onSellSubmitted() {
  sellModalHolding.value = null
  portfolioStore.fetchAll()
}

onMounted(() => {
  portfolioStore.fetchAll()
  fetchTaxSummary()
  fetchBuyOrders()
  fetchClientAccountsForOrders()
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

        <div v-if="otcSuccess" class="success-box">{{ otcSuccess }}</div>

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
                <th>OTC javno</th>
                <th>OTC rezervisano</th>
                <th>OTC dostupno</th>
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
                <td>{{ item.assetType === 'stock' ? formatQuantity(getPublicQuantity(item)) : '-' }}</td>
                <td>{{ item.assetType === 'stock' ? formatQuantity(getReservedQuantity(item)) : '-' }}</td>
                <td class="available-otc">{{ item.assetType === 'stock' ? formatQuantity(getAvailableForOtc(item)) : '-' }}</td>
                <td class="action-cell">
                  <button
                    v-if="item.assetType === 'stock'"
                    class="otc-btn"
                    :class="{ 'otc-active': getPublicQuantity(item) > 0 }"
                    @click="openOtcModal(item)"
                    title="Podesi koliko akcija je javno dostupno za OTC ponude"
                  >Podesi OTC</button>
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

      <!-- Buy order history -->
      <section class="panel buy-history-panel">
        <div class="panel-head">
          <div>
            <h2>Istorija kupovina akcija</h2>
            <span class="panel-meta">Svi nalozi kupovine, najnoviji prvo.</span>
          </div>
          <span class="panel-meta">{{ buyOrders.length }} naloga</span>
        </div>
        <div v-if="buyOrdersError" class="error-box" style="margin:0">{{ buyOrdersError }}</div>
        <div v-else-if="!buyOrders.length" class="empty-inline">Nema istorije kupovina.</div>
        <div v-else class="buy-history-wrap">
          <table class="portfolio-table buy-history-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Akcija</th>
                <th>Tip naloga</th>
                <th>Količina</th>
                <th>Stop</th>
                <th>Limit</th>
                <th>Margin</th>
                <th>AON</th>
                <th>After hours</th>
                <th>Račun</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in sortedBuyOrders" :key="o.id">
                <td>{{ formatOrderDate(o.createdAt) }}</td>
                <td class="ticker">{{ o.assetTicker }}</td>
                <td>{{ orderTypeLabel(o.orderType) }}</td>
                <td>{{ formatQuantity(o.quantity) }}</td>
                <td>{{ o.stopValue != null ? formatAmount(o.stopValue) : '-' }}</td>
                <td>{{ o.limitValue != null ? formatAmount(o.limitValue) : '-' }}</td>
                <td><span :class="['flag-badge', o.isMargin ? 'flag-on' : 'flag-off']">{{ o.isMargin ? 'Da' : 'Ne' }}</span></td>
                <td><span :class="['flag-badge', o.isAON ? 'flag-on' : 'flag-off']">{{ o.isAON ? 'Da' : 'Ne' }}</span></td>
                <td><span :class="['flag-badge', o.afterHours ? 'flag-on' : 'flag-off']">{{ o.afterHours ? 'Da' : 'Ne' }}</span></td>
                <td>{{ accountLabel(o.accountId) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Margin orders -->
      <section class="panel margin-history-panel">
        <div class="panel-head">
          <div>
            <h2>Margin nalozi</h2>
            <span class="panel-meta">Kupovine sa pozajmicom banke, najnoviji prvo.</span>
          </div>
          <span class="panel-meta">{{ marginOrders.length }} naloga</span>
        </div>
        <div v-if="!marginOrders.length" class="empty-inline">Nema margin naloga.</div>
        <div v-else class="buy-history-wrap">
          <table class="portfolio-table buy-history-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Akcija</th>
                <th>Tip</th>
                <th>Količina</th>
                <th>Račun klijenta</th>
                <th>Račun banke (pozajmica)</th>
                <th>Iznos pozajmice</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in marginOrders" :key="o.id">
                <td>{{ formatOrderDate(o.createdAt) }}</td>
                <td class="ticker">{{ o.assetTicker }}</td>
                <td>{{ orderTypeLabel(o.orderType) }}</td>
                <td>{{ formatQuantity(o.quantity) }}</td>
                <td>{{ accountLabel(o.accountId) }}</td>
                <td>{{ bankLoanAccountLabel(o) }}</td>
                <td><strong>{{ formatAmount(o.marginLoan) }}</strong></td>
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

      <div v-if="otcModalHolding" class="modal-backdrop" @click.self="closeOtcModal">
        <section class="otc-modal">
          <div class="modal-head">
            <div>
              <p class="modal-eyebrow">OTC javni rezim</p>
              <h2>{{ otcModalHolding.assetTicker }} / {{ otcModalHolding.assetName }}</h2>
              <span>Ukupno: {{ formatQuantity(otcModalHolding.quantity) }} | Rezervisano: {{ formatQuantity(getReservedQuantity(otcModalHolding)) }}</span>
            </div>
            <button class="close-btn" @click="closeOtcModal">x</button>
          </div>

          <form class="otc-form" @submit.prevent="saveOtcQuantity">
            <label>
              Kolicina javno dostupna za OTC
              <input
                v-model="otcPublicQuantity"
                type="number"
                min="0"
                :max="otcModalHolding.quantity"
                step="0.0001"
                required
              />
            </label>

            <div class="otc-preview">
              <div>
                <span>Privatno ostaje</span>
                <strong>{{ formatQuantity(Math.max(otcModalHolding.quantity - Number(otcPublicQuantity || 0), 0)) }}</strong>
              </div>
              <div>
                <span>Slobodno za nove ponude</span>
                <strong>{{ formatQuantity(Math.max(Number(otcPublicQuantity || 0) - getReservedQuantity(otcModalHolding), 0)) }}</strong>
              </div>
              <div>
                <span>Valuta</span>
                <strong>{{ otcModalHolding.currency }}</strong>
              </div>
            </div>

            <p class="otc-note">
              Vec rezervisana kolicina ostaje zakljucana do isteka ili buduceg izvrsenja ugovora.
            </p>

            <div v-if="otcError" class="error-box modal-error">{{ otcError }}</div>

            <div class="modal-actions">
              <button type="button" class="secondary-btn" @click="closeOtcModal">Odustani</button>
              <button type="submit" class="submit-btn" :disabled="savingOtcQuantity">
                {{ savingOtcQuantity ? 'Cuvam...' : 'Sacuvaj OTC kolicinu' }}
              </button>
            </div>
          </form>
        </section>
      </div>
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
.available-otc { color: #047857; font-weight: 700; }

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

.success-box {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  background: #dcfce7;
  color: #166534;
  font-weight: 700;
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

.buy-history-panel {
  margin-top: 24px;
}

.buy-history-wrap {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.buy-history-wrap .buy-history-table {
  margin: 0;
}

.buy-history-wrap thead th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  z-index: 1;
}

.flag-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.flag-on {
  background: #dbeafe;
  color: #1d4ed8;
}

.flag-off {
  background: #f1f5f9;
  color: #64748b;
}

.margin-history-panel {
  margin-top: 24px;
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

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.otc-modal {
  width: min(680px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
  padding: 24px;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.modal-head h2 {
  margin: 0;
  color: #0f172a;
}

.modal-head span {
  display: block;
  margin-top: 6px;
  color: #64748b;
}

.modal-eyebrow {
  margin: 0 0 6px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 10px;
  background: #f1f5f9;
  color: #475569;
  cursor: pointer;
  font-weight: 800;
}

.otc-form {
  display: grid;
  gap: 16px;
}

.otc-form label {
  display: grid;
  gap: 6px;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
}

.otc-form input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 12px;
  color: #0f172a;
  font: inherit;
}

.otc-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  border-radius: 14px;
  background: #f8fafc;
  padding: 14px;
}

.otc-preview span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.otc-preview strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
}

.otc-note {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.modal-error {
  margin: 0;
  padding: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.submit-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  cursor: pointer;
  font-weight: 800;
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
