<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useClientAuthStore } from '../../stores/clientAuth'
import {
  otcApi,
  type OtcOffer,
  type OtcOfferStatus,
  type OtcNegotiationEntry,
} from '../../api/otc'
import { interbankOtcApi, type InterbankNegotiation } from '../../api/interbankOtc'

const authStore = useClientAuthStore()

const offers = ref<OtcOffer[]>([])
const crossBankNegotiations = ref<InterbankNegotiation[]>([])
const loading = ref(false)
const error = ref('')

// Filters
const statusFilter = ref<OtcOfferStatus>('')
const fromFilter = ref('')
const toFilter = ref('')
const counterpartyFilter = ref('')

// Expanded-row history (local offers only — cross-bank has no per-step timeline endpoint)
const expandedKey = ref<string | null>(null)
const historyEntries = ref<OtcNegotiationEntry[]>([])
const historyLoading = ref(false)
const historyError = ref('')

const statuses: Array<{ value: OtcOfferStatus; label: string }> = [
  { value: '', label: 'Svi statusi' },
  { value: 'accepted', label: 'Prihvaćene' },
  { value: 'declined', label: 'Odbijene' },
  { value: 'cancelled', label: 'Otkazane' },
  { value: 'pending', label: 'Aktivne' },
]

const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const quantityFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const currentClientId = computed(() => Number(authStore.client?.id || 0))

function fmtMoney(value: number) {
  return moneyFormatter.format(value)
}
function fmtQuantity(value: number) {
  return quantityFormatter.format(value)
}
function fmtDate(value: string) {
  return value ? new Date(value).toLocaleDateString('sr-RS') : '—'
}
function fmtDateTime(value: string) {
  return value ? new Date(value).toLocaleString('sr-RS') : '—'
}

// ─── Unified negotiation row ───────────────────────────────────────────
// Local and cross-bank negotiations have different shapes; we normalize
// both into one row type so the history table can render them together.
type NegotiationSource = 'local' | 'crossbank'

interface UnifiedRow {
  key: string
  source: NegotiationSource
  displayId: string
  role: string
  counterparty: string
  counterpartyId: number
  ticker: string
  currency: string
  amount: number
  pricePerStock: number
  premium: number
  settlementDate: string
  statusKey: string
  statusLabel: string
  lastModified: string
  offer?: OtcOffer
  crossBank?: InterbankNegotiation
}

function localIsBuyer(offer: OtcOffer) {
  return offer.buyerType === 'client' && offer.buyerId === currentClientId.value
}

function statusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Aktivna'
    case 'accepted':
      return 'Prihvaćena'
    case 'declined':
      return 'Odbijena'
    case 'cancelled':
      return 'Otkazana'
    default:
      return status
  }
}

function actionLabel(action: string) {
  switch (action) {
    case 'created':
      return 'Inicijalna ponuda'
    case 'countered':
      return 'Kontraponuda'
    case 'accepted':
      return 'Prihvaćeno'
    case 'declined':
      return 'Odbijeno'
    case 'cancelled':
      return 'Otkazano'
    default:
      return action
  }
}

function localToRow(offer: OtcOffer): UnifiedRow {
  const isBuyer = localIsBuyer(offer)
  return {
    key: `local-${offer.id}`,
    source: 'local',
    displayId: `#${offer.id}`,
    role: isBuyer ? 'Kupac' : 'Prodavac',
    counterparty: isBuyer
      ? `#${offer.sellerId} / ${offer.sellerType}`
      : `#${offer.buyerId} / ${offer.buyerType}`,
    counterpartyId: isBuyer ? offer.sellerId : offer.buyerId,
    ticker: offer.ticker,
    currency: offer.exchange.currency,
    amount: offer.amount,
    pricePerStock: offer.pricePerStock,
    premium: offer.premium,
    settlementDate: offer.settlementDate,
    statusKey: offer.status,
    statusLabel: statusLabel(offer.status),
    lastModified: offer.lastModified,
    offer,
  }
}

function crossBankToRow(neg: InterbankNegotiation): UnifiedRow {
  const isBuyer = neg.localRole === 'buyer'
  return {
    key: `crossbank-${neg.negotiationRoutingNumber}-${neg.negotiationId}`,
    source: 'crossbank',
    displayId: `${neg.negotiationRoutingNumber}/${neg.negotiationId}`,
    role: isBuyer ? 'Kupac' : 'Prodavac',
    counterparty: `Banka ${neg.counterpartyRoutingNumber}`,
    counterpartyId: neg.counterpartyRoutingNumber,
    ticker: neg.stock.ticker,
    currency: neg.pricePerUnit.currency,
    amount: neg.amount,
    pricePerStock: neg.pricePerUnit.amount,
    premium: neg.premium.amount,
    settlementDate: neg.settlementDate,
    statusKey: neg.isOngoing ? 'ongoing' : 'closed',
    statusLabel: neg.isOngoing ? 'U toku' : 'Zatvoren',
    lastModified: neg.updatedAt,
    crossBank: neg,
  }
}

// crossBankMatchesStatus maps the local status filter onto the coarse
// ongoing/closed distinction cross-bank negotiations carry. Ongoing rows
// answer to "pending"; closed rows answer to the terminal statuses.
function crossBankMatchesStatus(neg: InterbankNegotiation, status: OtcOfferStatus) {
  switch (status) {
    case '':
      return true
    case 'pending':
      return neg.isOngoing
    case 'accepted':
    case 'declined':
    case 'cancelled':
      return !neg.isOngoing
    default:
      return true
  }
}

// Cross-bank negotiations are filtered client-side: the local/from/to/
// counterparty filters apply, but cross-bank only knows routing numbers
// (counterparty) and an ongoing/closed flag (status).
const filteredCrossBank = computed<UnifiedRow[]>(() => {
  const from = fromFilter.value ? new Date(fromFilter.value) : null
  const to = toFilter.value ? new Date(`${toFilter.value}T23:59:59`) : null
  const cp = counterpartyFilter.value ? Number(counterpartyFilter.value) : null

  return crossBankNegotiations.value
    .filter((neg) => crossBankMatchesStatus(neg, statusFilter.value))
    .filter((neg) => {
      if (!from && !to) return true
      const modified = new Date(neg.updatedAt)
      if (from && modified < from) return false
      if (to && modified > to) return false
      return true
    })
    .filter((neg) => cp == null || neg.counterpartyRoutingNumber === cp)
    .map(crossBankToRow)
})

const rows = computed<UnifiedRow[]>(() => {
  const merged = [...offers.value.map(localToRow), ...filteredCrossBank.value]
  return merged.sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  )
})

async function fetchNegotiations() {
  loading.value = true
  error.value = ''
  expandedKey.value = null
  try {
    // Local negotiations honour the filters server-side. Cross-bank
    // negotiations are fetched in full (ongoing + closed, both roles) and
    // filtered client-side — see filteredCrossBank.
    const [localRes, crossRes] = await Promise.allSettled([
      otcApi.listNegotiations({
        status: statusFilter.value || undefined,
        from: fromFilter.value || undefined,
        to: toFilter.value || undefined,
        counterparty: counterpartyFilter.value ? Number(counterpartyFilter.value) : undefined,
      }),
      interbankOtcApi.listNegotiations('', true),
    ])

    if (localRes.status === 'fulfilled') {
      offers.value = localRes.value.data.negotiations || []
    } else {
      offers.value = []
      error.value = 'Nije moguće učitati lokalnu istoriju pregovora.'
    }

    if (crossRes.status === 'fulfilled') {
      crossBankNegotiations.value = crossRes.value.data.negotiations || []
    } else {
      crossBankNegotiations.value = []
      // Don't clobber a local error; surface a softer note only if local loaded.
      if (!error.value) {
        error.value = 'Lokalni pregovori učitani; cross-bank pregovore nije moguće učitati.'
      }
    }
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  statusFilter.value = ''
  fromFilter.value = ''
  toFilter.value = ''
  counterpartyFilter.value = ''
  fetchNegotiations()
}

async function toggleHistory(row: UnifiedRow) {
  if (expandedKey.value === row.key) {
    expandedKey.value = null
    return
  }
  expandedKey.value = row.key
  historyEntries.value = []
  historyError.value = ''

  // Cross-bank negotiations have no per-step timeline endpoint; the expand
  // row renders a static summary instead (see template).
  if (row.source !== 'local' || !row.offer) {
    return
  }

  historyLoading.value = true
  try {
    const res = await otcApi.getNegotiationHistory(row.offer.id)
    historyEntries.value = res.data.entries || []
  } catch {
    historyError.value = 'Nije moguće učitati detalje pregovora.'
  } finally {
    historyLoading.value = false
  }
}

function crossBankLastModifiedByRole(neg: InterbankNegotiation) {
  const byBuyer =
    neg.lastModifiedBy.routingNumber === neg.buyerId.routingNumber &&
    neg.lastModifiedBy.id === neg.buyerId.id
  return byBuyer ? 'Kupac' : 'Prodavac'
}

onMounted(fetchNegotiations)
</script>

<template>
  <div class="otc-page">
    <div class="page-header">
      <div>
        <p class="eyebrow">OTC portal</p>
        <h1>Istorija pregovora</h1>
        <p>Kompletna istorija OTC ponuda u kojima ste učestvovali — lokalnih i cross-bank, sa svakom kontraponudom (stare i nove vrednosti).</p>
      </div>
      <div class="header-actions">
        <RouterLink to="/client/otc/offers" class="secondary-link">Aktivne ponude</RouterLink>
        <RouterLink to="/client/otc/contracts" class="primary-link">Sklopljeni ugovori</RouterLink>
      </div>
    </div>

    <section class="panel filters">
      <label>
        Status
        <select v-model="statusFilter">
          <option v-for="s in statuses" :key="s.value || 'all'" :value="s.value">{{ s.label }}</option>
        </select>
      </label>
      <label>
        Od
        <input v-model="fromFilter" type="date" />
      </label>
      <label>
        Do
        <input v-model="toFilter" type="date" />
      </label>
      <label>
        Druga strana (ID / rutni broj)
        <input v-model="counterpartyFilter" type="number" min="1" placeholder="npr. 5" />
      </label>
      <div class="filter-actions">
        <button class="submit-btn" @click="fetchNegotiations">Primeni</button>
        <button class="secondary-btn" @click="resetFilters">Poništi</button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Pregovori</h2>
          <span class="panel-meta">Klikni na red da vidiš timeline kontraponuda (lokalni) ili detalje (cross-bank).</span>
        </div>
        <span class="panel-meta">{{ rows.length }} pregovora</span>
      </div>

      <div v-if="loading" class="empty-state">Učitavam pregovore...</div>
      <div v-else-if="error" class="error-box">{{ error }}</div>
      <div v-else-if="rows.length === 0" class="empty-state">Nema pregovora za izabrani filter.</div>
      <div v-else class="table-wrap">
        <table class="otc-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tip</th>
              <th>Uloga</th>
              <th>Druga strana</th>
              <th>Ticker</th>
              <th>Količina</th>
              <th>Cena</th>
              <th>Premija</th>
              <th>Settlement</th>
              <th>Status</th>
              <th>Poslednja izmena</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in rows" :key="row.key">
              <tr class="clickable" @click="toggleHistory(row)">
                <td class="offer-id">{{ row.displayId }}</td>
                <td>
                  <span class="source-pill" :class="row.source">
                    {{ row.source === 'crossbank' ? 'Cross-bank' : 'Lokalni' }}
                  </span>
                </td>
                <td>{{ row.role }}</td>
                <td>{{ row.counterparty }}</td>
                <td>
                  <div class="ticker">{{ row.ticker }}</div>
                  <div class="asset-meta">{{ row.currency }}</div>
                </td>
                <td>{{ fmtQuantity(row.amount) }}</td>
                <td>{{ fmtMoney(row.pricePerStock) }}</td>
                <td>{{ fmtMoney(row.premium) }}</td>
                <td>{{ fmtDate(row.settlementDate) }}</td>
                <td><span class="status-pill" :class="row.statusKey">{{ row.statusLabel }}</span></td>
                <td class="asset-meta">{{ fmtDateTime(row.lastModified) }}</td>
                <td class="expand-cell">{{ expandedKey === row.key ? '▲' : '▼' }}</td>
              </tr>
              <tr v-if="expandedKey === row.key" class="history-row">
                <td colspan="12">
                  <!-- Cross-bank: no per-step timeline endpoint; show a summary. -->
                  <div v-if="row.source === 'crossbank' && row.crossBank" class="cross-summary">
                    <span>Pregovor: <strong>{{ row.displayId }}</strong></span>
                    <span>Banka druge strane: <strong>{{ row.crossBank.counterpartyRoutingNumber }}</strong></span>
                    <span>Poslednju izmenu napravio: <strong>{{ crossBankLastModifiedByRole(row.crossBank) }}</strong></span>
                    <span>Kreirano: <strong>{{ fmtDateTime(row.crossBank.createdAt) }}</strong></span>
                    <span class="cross-note">Detaljan timeline kontraponuda nije dostupan za cross-bank pregovore.</span>
                  </div>
                  <!-- Local: full counter-offer timeline. -->
                  <template v-else>
                    <div v-if="historyLoading" class="empty-inline">Učitavam timeline...</div>
                    <div v-else-if="historyError" class="error-box" style="margin:0">{{ historyError }}</div>
                    <div v-else-if="historyEntries.length === 0" class="empty-inline">Nema zabeleženih koraka.</div>
                    <ol v-else class="timeline">
                      <li v-for="entry in historyEntries" :key="entry.id">
                        <div class="timeline-head">
                          <span class="timeline-action" :class="entry.action">{{ actionLabel(entry.action) }}</span>
                          <span class="timeline-actor">#{{ entry.actorId }} / {{ entry.actorType }}</span>
                          <span class="timeline-time">{{ fmtDateTime(entry.createdAt) }}</span>
                        </div>
                        <div class="timeline-terms">
                          <span>Količina: <strong>{{ fmtQuantity(entry.amount) }}</strong>
                            <em v-if="entry.prevAmount != null && entry.prevAmount !== entry.amount"> (bilo {{ fmtQuantity(entry.prevAmount) }})</em>
                          </span>
                          <span>Cena: <strong>{{ fmtMoney(entry.pricePerStock) }}</strong>
                            <em v-if="entry.prevPricePerStock != null && entry.prevPricePerStock !== entry.pricePerStock"> (bilo {{ fmtMoney(entry.prevPricePerStock) }})</em>
                          </span>
                          <span>Premija: <strong>{{ fmtMoney(entry.premium) }}</strong>
                            <em v-if="entry.prevPremium != null && entry.prevPremium !== entry.premium"> (bilo {{ fmtMoney(entry.prevPremium) }})</em>
                          </span>
                          <span>Settlement: <strong>{{ fmtDate(entry.settlementDate) }}</strong>
                            <em v-if="entry.prevSettlementDate && entry.prevSettlementDate !== entry.settlementDate"> (bilo {{ fmtDate(entry.prevSettlementDate) }})</em>
                          </span>
                        </div>
                      </li>
                    </ol>
                  </template>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.otc-page {
  max-width: 1240px;
  margin: 0 auto;
  padding: 32px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-header h1 {
  margin: 0;
  color: #0f172a;
  font-size: 30px;
}

.page-header p:not(.eyebrow) {
  margin: 8px 0 0;
  color: #64748b;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.primary-link,
.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 700;
  text-decoration: none;
}

.primary-link {
  background: #0f172a;
  color: #fff;
}

.secondary-link {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
}

.panel {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  padding: 24px;
  margin-bottom: 20px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
}

.filters label {
  display: grid;
  gap: 6px;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
}

.filters select,
.filters input {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 9px 12px;
  color: #0f172a;
  font: inherit;
  min-width: 150px;
}

.filter-actions {
  display: flex;
  gap: 10px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.panel-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
}

.panel-meta {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.empty-state,
.error-box,
.empty-inline {
  border-radius: 12px;
  padding: 18px;
  color: #64748b;
  background: #f8fafc;
}

.error-box {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.table-wrap {
  overflow-x: auto;
}

.otc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.otc-table th,
.otc-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  white-space: nowrap;
}

.otc-table th {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  background: #f8fafc;
}

.offer-id,
.ticker {
  color: #1d4ed8;
  font-weight: 800;
}

.asset-meta {
  margin-top: 2px;
  color: #64748b;
  font-size: 12px;
}

.expand-cell {
  color: #94a3b8;
}

.source-pill {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 800;
}

.source-pill.local {
  background: #e2e8f0;
  color: #334155;
}

.source-pill.crossbank {
  background: #e0e7ff;
  color: #3730a3;
}

.status-pill {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 9px;
  background: #e2e8f0;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.status-pill.pending,
.status-pill.ongoing {
  background: #fef3c7;
  color: #92400e;
}

.status-pill.accepted {
  background: #dcfce7;
  color: #166534;
}

.status-pill.declined,
.status-pill.cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.status-pill.closed {
  background: #f1f5f9;
  color: #475569;
}

.history-row td {
  background: #f8fafc;
  white-space: normal;
}

.cross-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: #475569;
  font-size: 13px;
  padding: 4px 0;
}

.cross-note {
  width: 100%;
  color: #94a3b8;
  font-style: italic;
}

.timeline {
  list-style: none;
  margin: 0;
  padding: 4px 0 4px 4px;
  display: grid;
  gap: 12px;
}

.timeline li {
  border-left: 3px solid #cbd5e1;
  padding: 4px 0 4px 14px;
}

.timeline-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.timeline-action {
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 800;
  background: #e2e8f0;
  color: #334155;
}

.timeline-action.created {
  background: #e0e7ff;
  color: #3730a3;
}

.timeline-action.countered {
  background: #fef3c7;
  color: #92400e;
}

.timeline-action.accepted {
  background: #dcfce7;
  color: #166534;
}

.timeline-action.declined,
.timeline-action.cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.timeline-actor {
  color: #475569;
  font-weight: 700;
  font-size: 13px;
}

.timeline-time {
  color: #94a3b8;
  font-size: 12px;
}

.timeline-terms {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: #475569;
  font-size: 13px;
}

.timeline-terms em {
  color: #b45309;
  font-style: italic;
}

.submit-btn {
  background: #0f172a;
  color: #fff;
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
}

.secondary-btn {
  background: #f1f5f9;
  color: #475569;
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
}

@media (max-width: 900px) {
  .page-header,
  .panel-head {
    flex-direction: column;
  }
}
</style>
