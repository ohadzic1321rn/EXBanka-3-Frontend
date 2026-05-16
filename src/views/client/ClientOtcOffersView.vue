<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useOtcStore } from '../../stores/otc'
import type { OtcOffer, OtcOfferStatus } from '../../api/otc'

const otcStore = useOtcStore()
const authStore = useClientAuthStore()
const successMessage = ref('')
const actionError = ref('')
const selectedOffer = ref<OtcOffer | null>(null)
const counterAmount = ref('')
const counterPrice = ref('')
const counterPremium = ref('')
const counterSettlementDate = ref('')
const counterError = ref('')

const statuses: Array<{ value: OtcOfferStatus; label: string }> = [
  { value: 'pending', label: 'Aktivne' },
  { value: '', label: 'Sve' },
  { value: 'accepted', label: 'Prihvacene' },
  { value: 'declined', label: 'Odbijene' },
  { value: 'cancelled', label: 'Otkazane' },
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

const sortedOffers = computed(() =>
  [...otcStore.offers].sort((left, right) =>
    new Date(right.lastModified).getTime() - new Date(left.lastModified).getTime() || right.id - left.id
  )
)

const minSettlementDate = computed(() => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
})

function fmtMoney(value: number) {
  return moneyFormatter.format(value)
}

function fmtDeviation(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0
  return `${safeValue > 0 ? '+' : ''}${safeValue.toFixed(2)}%`
}

function fmtQuantity(value: number) {
  return quantityFormatter.format(value)
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('sr-RS')
}

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString('sr-RS')
}

function statusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Aktivna'
    case 'accepted':
      return 'Prihvacena'
    case 'declined':
      return 'Odbijena'
    case 'cancelled':
      return 'Otkazana'
    default:
      return status
  }
}

function isBuyer(offer: OtcOffer) {
  return offer.buyerType === 'client' && offer.buyerId === currentClientId.value
}

function isSeller(offer: OtcOffer) {
  return offer.sellerType === 'client' && offer.sellerId === currentClientId.value
}

function isLastModifier(offer: OtcOffer) {
  return offer.modifiedByType === 'client' && offer.modifiedById === currentClientId.value
}

function isParticipant(offer: OtcOffer) {
  return isBuyer(offer) || isSeller(offer)
}

function participantRole(offer: OtcOffer) {
  if (isBuyer(offer)) return 'Kupac'
  if (isSeller(offer)) return 'Prodavac'
  return 'Ucesnik'
}

function deviationClass(offer: OtcOffer) {
  const absoluteDeviation = Math.abs(Number.isFinite(offer.deviationPct) ? offer.deviationPct : 0)
  if (absoluteDeviation <= 5) return 'deviation-green'
  if (absoluteDeviation <= 20) return 'deviation-yellow'
  return 'deviation-red'
}

function canCounter(offer: OtcOffer) {
  return offer.status === 'pending' && isParticipant(offer)
}

function canAccept(offer: OtcOffer) {
  return offer.status === 'pending' && isParticipant(offer) && !isLastModifier(offer)
}

function canDecline(offer: OtcOffer) {
  return offer.status === 'pending' && isSeller(offer)
}

function canCancel(offer: OtcOffer) {
  return offer.status === 'pending' && isBuyer(offer)
}

function changeStatus(status: OtcOfferStatus) {
  clearMessages()
  otcStore.fetchOffers(status)
}

function clearMessages() {
  successMessage.value = ''
  actionError.value = ''
  counterError.value = ''
}

function openCounterForm(offer: OtcOffer) {
  selectedOffer.value = offer
  counterAmount.value = String(offer.amount)
  counterPrice.value = String(offer.pricePerStock)
  counterPremium.value = String(offer.premium)
  counterSettlementDate.value = offer.settlementDate.slice(0, 10)
  clearMessages()
}

function closeCounterForm() {
  selectedOffer.value = null
  counterError.value = ''
}

function validateCounterForm() {
  const amount = Number(counterAmount.value)
  const price = Number(counterPrice.value)
  const premium = Number(counterPremium.value)
  if (!selectedOffer.value) return 'Nije izabrana ponuda.'
  if (!Number.isFinite(amount) || amount <= 0) return 'Kolicina mora biti veca od nule.'
  if (!Number.isFinite(price) || price <= 0) return 'Cena po akciji mora biti veca od nule.'
  if (!Number.isFinite(premium) || premium < 0) return 'Premija ne moze biti negativna.'
  if (!counterSettlementDate.value) return 'Settlement date je obavezan.'
  if (counterSettlementDate.value < minSettlementDate.value) return 'Settlement date mora biti u buducnosti.'
  return ''
}

async function submitCounter() {
  const validation = validateCounterForm()
  if (validation) {
    counterError.value = validation
    return
  }

  const offer = selectedOffer.value!
  try {
    await otcStore.counterOffer(offer.id, {
      amount: Number(counterAmount.value),
      pricePerStock: Number(counterPrice.value),
      settlementDate: counterSettlementDate.value,
      premium: Number(counterPremium.value),
    })
    successMessage.value = `Kontraponuda za ponudu #${offer.id} je poslata.`
    closeCounterForm()
    await otcStore.fetchOffers()
  } catch {
    counterError.value = otcStore.error || 'Nije moguce poslati kontraponudu.'
  }
}

async function acceptOffer(offer: OtcOffer) {
  clearMessages()
  if (!window.confirm(`Prihvatiti OTC ponudu #${offer.id}? Premija se naplacuje odmah.`)) return
  try {
    const contract = await otcStore.acceptOffer(offer.id)
    successMessage.value = `Ponuda #${offer.id} je prihvacena. Kreiran je ugovor #${contract.id}.`
    await otcStore.fetchOffers()
  } catch {
    actionError.value = otcStore.error || 'Nije moguce prihvatiti ponudu.'
  }
}

async function declineOffer(offer: OtcOffer) {
  clearMessages()
  if (!window.confirm(`Odbiti OTC ponudu #${offer.id}?`)) return
  try {
    await otcStore.declineOffer(offer.id)
    successMessage.value = `Ponuda #${offer.id} je odbijena.`
    await otcStore.fetchOffers()
  } catch {
    actionError.value = otcStore.error || 'Nije moguce odbiti ponudu.'
  }
}

async function cancelOffer(offer: OtcOffer) {
  clearMessages()
  if (!window.confirm(`Otkazati OTC ponudu #${offer.id}?`)) return
  try {
    await otcStore.cancelOffer(offer.id)
    successMessage.value = `Ponuda #${offer.id} je otkazana.`
    await otcStore.fetchOffers()
  } catch {
    actionError.value = otcStore.error || 'Nije moguce otkazati ponudu.'
  }
}

onMounted(() => {
  otcStore.fetchOffers('pending')
})
</script>

<template>
  <div class="otc-page">
    <div class="page-header">
      <div>
        <p class="eyebrow">OTC portal</p>
        <h1>Aktivne ponude</h1>
        <p>Pregled pregovora i osnovne akcije za lokalne OTC ponude. Izvrsenje opcije ostaje van ovog sprinta.</p>
      </div>
      <div class="header-actions">
        <RouterLink to="/client/otc" class="secondary-link">Javne akcije</RouterLink>
        <RouterLink to="/client/otc/contracts" class="primary-link">Sklopljeni ugovori</RouterLink>
      </div>
    </div>

    <div class="summary-grid">
      <article class="summary-card">
        <span>Ponude u prikazu</span>
        <strong>{{ otcStore.offers.length }}</strong>
      </article>
      <article class="summary-card">
        <span>Aktivne ponude</span>
        <strong>{{ otcStore.pendingOffers.length }}</strong>
      </article>
      <article class="summary-card">
        <span>Scope</span>
        <strong>Pregovori</strong>
      </article>
    </div>

    <div v-if="successMessage" class="success-box">{{ successMessage }}</div>
    <div v-if="actionError" class="error-box">{{ actionError }}</div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>OTC pregovori</h2>
          <span class="panel-meta">Kupac moze da otkaze ponudu, prodavac da odbije, a strana koja nije poslednja menjala uslove moze da prihvati ili posalje kontraponudu.</span>
        </div>
        <div class="status-tabs">
          <button
            v-for="status in statuses"
            :key="status.value || 'all'"
            class="status-tab"
            :class="{ active: otcStore.selectedOfferStatus === status.value }"
            @click="changeStatus(status.value)"
          >
            {{ status.label }}
          </button>
        </div>
      </div>

      <div v-if="otcStore.loadingOffers" class="empty-state">Ucitavam OTC ponude...</div>
      <div v-else-if="otcStore.error" class="error-box">{{ otcStore.error }}</div>
      <div v-else-if="sortedOffers.length === 0" class="empty-state">
        Nema ponuda za izabrani filter.
      </div>
      <div v-else class="table-wrap">
        <table class="otc-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Uloga</th>
              <th>Ticker</th>
              <th>Kolicina</th>
              <th>Cena</th>
              <th>Odstupanje</th>
              <th>Premija</th>
              <th>Settlement</th>
              <th>Status</th>
              <th>Buyer</th>
              <th>Seller</th>
              <th>Izmenio</th>
              <th>Akcije</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="offer in sortedOffers" :key="offer.id">
              <td class="offer-id">#{{ offer.id }}</td>
              <td>{{ participantRole(offer) }}</td>
              <td>
                <div class="ticker">{{ offer.ticker }}</div>
                <div class="asset-meta">{{ offer.name }} / {{ offer.exchange.currency }}</div>
              </td>
              <td>{{ fmtQuantity(offer.amount) }}</td>
              <td>{{ fmtMoney(offer.pricePerStock) }}</td>
              <td>
                <span class="deviation-pill" :class="deviationClass(offer)">
                  {{ fmtDeviation(offer.deviationPct) }}
                </span>
                <div class="asset-meta">Market {{ fmtMoney(offer.currentPrice) }}</div>
              </td>
              <td>{{ fmtMoney(offer.premium) }}</td>
              <td>{{ fmtDate(offer.settlementDate) }}</td>
              <td>
                <span class="status-pill" :class="offer.status">{{ statusLabel(offer.status) }}</span>
              </td>
              <td>#{{ offer.buyerId }} / {{ offer.buyerType }}</td>
              <td>#{{ offer.sellerId }} / {{ offer.sellerType }}</td>
              <td>
                <div>#{{ offer.modifiedById }} / {{ offer.modifiedByType }}</div>
                <div class="asset-meta">{{ fmtDateTime(offer.lastModified) }}</div>
              </td>
              <td>
                <div v-if="offer.status === 'pending'" class="action-row">
                  <button v-if="canCounter(offer)" class="action-btn neutral" @click="openCounterForm(offer)">
                    Kontra
                  </button>
                  <button v-if="canAccept(offer)" class="action-btn positive" :disabled="otcStore.updatingOffer" @click="acceptOffer(offer)">
                    Prihvati
                  </button>
                  <button v-if="canDecline(offer)" class="action-btn danger" :disabled="otcStore.updatingOffer" @click="declineOffer(offer)">
                    Odbij
                  </button>
                  <button v-if="canCancel(offer)" class="action-btn danger" :disabled="otcStore.updatingOffer" @click="cancelOffer(offer)">
                    Otkazi
                  </button>
                </div>
                <span v-else class="asset-meta">Zakljucano</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="selectedOffer" class="modal-backdrop" @click.self="closeCounterForm">
      <section class="offer-modal">
        <div class="modal-head">
          <div>
            <p class="eyebrow">Kontraponuda</p>
            <h2>#{{ selectedOffer.id }} / {{ selectedOffer.ticker }}</h2>
            <span>Promeni kolicinu, cenu, premiju ili settlement date.</span>
          </div>
          <button class="close-btn" @click="closeCounterForm">x</button>
        </div>

        <form class="offer-form" @submit.prevent="submitCounter">
          <div class="form-grid">
            <label>
              Kolicina akcija
              <input v-model="counterAmount" type="number" min="0.0001" step="0.0001" required />
            </label>
            <label>
              Cena po akciji
              <input v-model="counterPrice" type="number" min="0.01" step="0.01" required />
            </label>
            <label>
              Premija
              <input v-model="counterPremium" type="number" min="0" step="0.01" required />
            </label>
            <label>
              Settlement date
              <input v-model="counterSettlementDate" type="date" :min="minSettlementDate" required />
            </label>
          </div>

          <div class="offer-preview">
            <div><span>Valuta</span><strong>{{ selectedOffer.exchange.currency }}</strong></div>
            <div><span>Ukupna strike vrednost</span><strong>{{ fmtMoney(Number(counterAmount || 0) * Number(counterPrice || 0)) }}</strong></div>
            <div><span>Premija</span><strong>{{ fmtMoney(Number(counterPremium || 0)) }}</strong></div>
          </div>

          <div v-if="counterError || otcStore.error" class="error-box">
            {{ counterError || otcStore.error }}
          </div>

          <div class="modal-actions">
            <button type="button" class="secondary-btn" @click="closeCounterForm">Odustani</button>
            <button type="submit" class="submit-btn" :disabled="otcStore.updatingOffer">
              {{ otcStore.updatingOffer ? 'Saljem...' : 'Posalji kontraponudu' }}
            </button>
          </div>
        </form>
      </section>
    </div>
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card,
.panel {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.summary-card {
  padding: 18px 20px;
}

.summary-card span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.summary-card strong {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 24px;
}

.panel {
  padding: 24px;
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

.status-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-tab {
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  padding: 8px 12px;
  font-weight: 700;
}

.status-tab.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}

.empty-state,
.error-box,
.success-box {
  border-radius: 12px;
  padding: 18px;
  color: #64748b;
  background: #f8fafc;
}

.success-box {
  margin-bottom: 18px;
  color: #166534;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
}

.error-box {
  margin-bottom: 18px;
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

.status-pill {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 9px;
  background: #e2e8f0;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.deviation-pill {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 900;
}

.deviation-green {
  background: #dcfce7;
  color: #166534;
}

.deviation-yellow {
  background: #fef3c7;
  color: #92400e;
}

.deviation-red {
  background: #fee2e2;
  color: #991b1b;
}

.status-pill.pending {
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

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.action-btn,
.submit-btn,
.secondary-btn,
.close-btn {
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
}

.action-btn {
  padding: 7px 10px;
}

.action-btn.neutral {
  background: #eff6ff;
  color: #1d4ed8;
}

.action-btn.positive {
  background: #dcfce7;
  color: #166534;
}

.action-btn.danger {
  background: #fee2e2;
  color: #991b1b;
}

.action-btn:disabled,
.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

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

.offer-modal {
  width: min(720px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
  padding: 24px;
}

.modal-head {
  display: flex;
  align-items: flex-start;
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

.close-btn {
  width: 32px;
  height: 32px;
  background: #f1f5f9;
  color: #475569;
}

.offer-form {
  display: grid;
  gap: 16px;
}

.offer-form label {
  display: grid;
  gap: 6px;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
}

.offer-form input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 12px;
  color: #0f172a;
  font: inherit;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.offer-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  border-radius: 14px;
  background: #f8fafc;
  padding: 14px;
}

.offer-preview span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.offer-preview strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.secondary-btn {
  background: #f1f5f9;
  color: #475569;
  padding: 10px 14px;
}

.submit-btn {
  background: #0f172a;
  color: #fff;
  padding: 10px 16px;
}

@media (max-width: 900px) {
  .page-header,
  .panel-head {
    flex-direction: column;
  }

  .summary-grid,
  .form-grid,
  .offer-preview {
    grid-template-columns: 1fr;
  }
}
</style>
