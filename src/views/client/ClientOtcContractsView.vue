<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useOtcStore } from '../../stores/otc'
import { useClientAuthStore } from '../../stores/clientAuth'
import type { OtcContract, OtcContractStatus } from '../../api/otc'

const otcStore = useOtcStore()
const authStore = useClientAuthStore()
const statuses: Array<{ value: OtcContractStatus; label: string }> = [
  { value: '', label: 'Svi' },
  { value: 'valid', label: 'Vazeci' },
  { value: 'expired', label: 'Istekli' },
  { value: 'exercised', label: 'Iskorisceni' },
]

const exerciseTarget = ref<OtcContract | null>(null)
const exerciseError = ref('')
const exerciseSuccess = ref('')

const currentClientId = computed(() => Number(authStore.client?.id || 0))

const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const quantityFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const sortedContracts = computed(() =>
  [...otcStore.contracts].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || right.id - left.id
  )
)

function fmtMoney(value: number) {
  return moneyFormatter.format(value)
}

function fmtQuantity(value: number) {
  return quantityFormatter.format(value)
}

function statusLabel(status: string) {
  switch (status) {
    case 'valid':
      return 'Vazeci'
    case 'expired':
      return 'Istekao'
    case 'exercised':
      return 'Iskoriscen'
    default:
      return status
  }
}

function profitClass(value: number) {
  if (value > 0) return 'profit-positive'
  if (value < 0) return 'profit-negative'
  return 'profit-neutral'
}

function changeStatus(status: OtcContractStatus) {
  otcStore.fetchContracts(status)
}

function isBuyer(contract: OtcContract) {
  return contract.buyerType === 'client' && contract.buyerId === currentClientId.value
}

function isExercisable(contract: OtcContract) {
  if (contract.status !== 'valid' || !isBuyer(contract)) return false
  const settlement = new Date(contract.settlementDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return settlement >= today
}

function openExerciseModal(contract: OtcContract) {
  exerciseTarget.value = contract
  exerciseError.value = ''
  exerciseSuccess.value = ''
  otcStore.clearSagaProgress()
}

function closeExerciseModal() {
  exerciseTarget.value = null
  exerciseError.value = ''
  otcStore.clearSagaProgress()
}

async function confirmExercise() {
  if (!exerciseTarget.value) return
  const target = exerciseTarget.value
  exerciseError.value = ''
  try {
    await otcStore.exerciseContract(target.id)
    exerciseSuccess.value = `Ugovor #${target.id} je iskoriscen.`
    await otcStore.fetchContracts()
  } catch {
    exerciseError.value = otcStore.sagaError || 'Iskoriscavanje opcije nije uspelo.'
  }
}

function sagaStepLabel(name: string) {
  switch (name) {
    case 'reserve_buyer_funds':
      return '1. Rezervacija sredstava kupca'
    case 'verify_seller_shares':
      return '2. Provera hartija prodavca'
    case 'transfer_funds':
      return '3. Transfer sredstava'
    case 'transfer_ownership':
      return '4. Transfer vlasnistva'
    case 'finalize_and_consistency_check':
      return '5. Finalna provera'
    default:
      return name
  }
}

function sagaStepStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Ceka'
    case 'in_progress':
      return 'U toku'
    case 'completed':
      return 'Zavrseno'
    case 'failed':
      return 'Neuspesno'
    case 'compensated':
      return 'Vraceno'
    default:
      return status
  }
}

function sagaOverallLabel(status: string) {
  switch (status) {
    case 'in_progress':
      return 'SAGA u toku'
    case 'completed':
      return 'SAGA uspesno zavrsena'
    case 'failed':
      return 'SAGA neuspesno'
    case 'rolling_back':
      return 'SAGA rollback u toku'
    case 'rolled_back':
      return 'SAGA vracena'
    case 'requires_manual_intervention':
      return 'Potrebna intervencija operatera'
    default:
      return status
  }
}

onMounted(() => {
  otcStore.fetchContracts()
})
</script>

<template>
  <div class="otc-page">
    <div class="page-header">
      <div>
        <p class="eyebrow">OTC portal</p>
        <h1>Sklopljeni ugovori</h1>
        <p>Read-only pregled opcionih ugovora nastalih prihvatanjem OTC ponuda.</p>
      </div>
      <div class="header-actions">
        <RouterLink to="/client/otc" class="secondary-link">Javne akcije</RouterLink>
        <RouterLink to="/client/otc/offers" class="secondary-link">Aktivne ponude</RouterLink>
      </div>
    </div>

    <div class="summary-grid">
      <article class="summary-card">
        <span>Ugovori u prikazu</span>
        <strong>{{ otcStore.contracts.length }}</strong>
      </article>
      <article class="summary-card">
        <span>Vazeci ugovori</span>
        <strong>{{ otcStore.validContracts.length }}</strong>
      </article>
      <article class="summary-card">
        <span>Izvrsenje opcije</span>
        <strong>SAGA aktivirana</strong>
      </article>
    </div>

    <div v-if="exerciseSuccess" class="success-box">{{ exerciseSuccess }}</div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Opcioni ugovori</h2>
          <span class="panel-meta">Vazeci ugovori za koje je korisnik kupac mogu se iskoristiti dok je settlement datum jos vazeci.</span>
        </div>
        <div class="status-tabs">
          <button
            v-for="status in statuses"
            :key="status.value || 'all'"
            class="status-tab"
            :class="{ active: otcStore.selectedContractStatus === status.value }"
            @click="changeStatus(status.value)"
          >
            {{ status.label }}
          </button>
        </div>
      </div>

      <div v-if="otcStore.loadingContracts" class="empty-state">Ucitavam OTC ugovore...</div>
      <div v-else-if="otcStore.error" class="error-box">{{ otcStore.error }}</div>
      <div v-else-if="sortedContracts.length === 0" class="empty-state">
        Nema ugovora za izabrani filter.
      </div>
      <div v-else class="table-wrap">
        <table class="otc-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ticker</th>
              <th>Kolicina</th>
              <th>Strike cena</th>
              <th>Trzisna / Exercise cena</th>
              <th>Premija</th>
              <th>Profit (Buyer)</th>
              <th>Profit (Seller)</th>
              <th>Settlement</th>
              <th>Status</th>
              <th>Buyer</th>
              <th>Seller</th>
              <th>Kreiran</th>
              <th>Akcije</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="contract in sortedContracts" :key="contract.id">
              <td class="contract-id">#{{ contract.id }}</td>
              <td>
                <div class="ticker">{{ contract.ticker }}</div>
                <div class="asset-meta">{{ contract.name }} / {{ contract.exchange.currency }}</div>
              </td>
              <td>{{ fmtQuantity(contract.amount) }}</td>
              <td>{{ fmtMoney(contract.strikePrice) }}</td>
              <td>
                {{ fmtMoney(contract.status === 'exercised' ? contract.exercisedAtPrice : contract.currentPrice) }}
                <div v-if="contract.status === 'exercised'" class="asset-meta">na trenutku exercise-a</div>
              </td>
              <td>{{ fmtMoney(contract.premium) }}</td>
              <td :class="profitClass(contract.buyerProfit)">
                {{ fmtMoney(contract.buyerProfit) }} {{ contract.exchange.currency }}
              </td>
              <td :class="profitClass(contract.sellerProfit)">
                {{ fmtMoney(contract.sellerProfit) }} {{ contract.exchange.currency }}
              </td>
              <td>{{ new Date(contract.settlementDate).toLocaleDateString('sr-RS') }}</td>
              <td>
                <span class="status-pill" :class="contract.status">{{ statusLabel(contract.status) }}</span>
              </td>
              <td>#{{ contract.buyerId }} / {{ contract.buyerType }}</td>
              <td>#{{ contract.sellerId }} / {{ contract.sellerType }}</td>
              <td>{{ new Date(contract.createdAt).toLocaleString('sr-RS') }}</td>
              <td>
                <button
                  v-if="isExercisable(contract)"
                  class="exercise-btn"
                  @click="openExerciseModal(contract)"
                >
                  Iskoristi
                </button>
                <span v-else class="asset-meta">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="exerciseTarget" class="modal-backdrop" @click.self="closeExerciseModal">
      <section class="exercise-modal">
        <div class="modal-head">
          <div>
            <p class="eyebrow">Iskoriscavanje opcije</p>
            <h2>#{{ exerciseTarget.id }} / {{ exerciseTarget.ticker }}</h2>
            <span>SAGA pokrece 5 koraka i automatski se rollback-uje na gresci.</span>
          </div>
          <button class="close-btn" @click="closeExerciseModal" :disabled="otcStore.exercisingContract">x</button>
        </div>

        <div class="exercise-summary">
          <div><span>Kolicina</span><strong>{{ fmtQuantity(exerciseTarget.amount) }}</strong></div>
          <div><span>Strike cena</span><strong>{{ fmtMoney(exerciseTarget.strikePrice) }} {{ exerciseTarget.exchange.currency }}</strong></div>
          <div><span>Trzisna cena</span><strong>{{ fmtMoney(exerciseTarget.currentPrice) }} {{ exerciseTarget.exchange.currency }}</strong></div>
          <div><span>Premija</span><strong>{{ fmtMoney(exerciseTarget.premium) }} {{ exerciseTarget.exchange.currency }}</strong></div>
          <div>
            <span>Procenjeni profit (Buyer)</span>
            <strong :class="profitClass(exerciseTarget.buyerProfit)">
              {{ fmtMoney(exerciseTarget.buyerProfit) }} {{ exerciseTarget.exchange.currency }}
            </strong>
          </div>
          <div>
            <span>Procenjeni profit (Seller)</span>
            <strong :class="profitClass(exerciseTarget.sellerProfit)">
              {{ fmtMoney(exerciseTarget.sellerProfit) }} {{ exerciseTarget.exchange.currency }}
            </strong>
          </div>
          <div><span>Settlement</span><strong>{{ new Date(exerciseTarget.settlementDate).toLocaleDateString('sr-RS') }}</strong></div>
        </div>

        <div v-if="otcStore.currentSaga" class="saga-progress">
          <div class="saga-overall">
            <span>Status:</span>
            <strong :class="`saga-status saga-${otcStore.currentSaga.status}`">
              {{ sagaOverallLabel(otcStore.currentSaga.status) }}
            </strong>
          </div>
          <ol class="saga-steps">
            <li
              v-for="step in otcStore.currentSaga.steps"
              :key="step.stepNumber"
              :class="`saga-step saga-step-${step.status}`"
            >
              <span class="saga-step-name">{{ sagaStepLabel(step.name) }}</span>
              <span class="saga-step-status">{{ sagaStepStatusLabel(step.status) }}</span>
              <span v-if="step.errorMessage" class="saga-step-error">{{ step.errorMessage }}</span>
            </li>
          </ol>
        </div>

        <div v-if="exerciseError" class="error-box">{{ exerciseError }}</div>

        <div class="modal-actions">
          <button
            type="button"
            class="secondary-btn"
            @click="closeExerciseModal"
            :disabled="otcStore.exercisingContract"
          >
            Zatvori
          </button>
          <button
            v-if="!exerciseSuccess && (!otcStore.currentSaga || otcStore.currentSaga.status === 'in_progress' || otcStore.currentSaga.status === 'rolling_back')"
            type="button"
            class="submit-btn"
            :disabled="otcStore.exercisingContract"
            @click="confirmExercise"
          >
            {{ otcStore.exercisingContract ? 'Pokrecem SAGA...' : 'Pokreni iskoriscavanje' }}
          </button>
        </div>
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

.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: #0f172a;
  font-weight: 700;
  text-decoration: none;
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
.error-box {
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

.contract-id,
.ticker {
  color: #1d4ed8;
  font-weight: 800;
}

.asset-meta {
  margin-top: 2px;
  color: #64748b;
  font-size: 12px;
}

.profit-positive {
  color: #047857;
  font-weight: 800;
}

.profit-negative {
  color: #b91c1c;
  font-weight: 800;
}

.profit-neutral {
  color: #475569;
  font-weight: 800;
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

.status-pill.valid {
  background: #dcfce7;
  color: #166534;
}

.status-pill.expired {
  background: #f1f5f9;
  color: #475569;
}

.status-pill.exercised {
  background: #dbeafe;
  color: #1d4ed8;
}

.exercise-btn {
  border: none;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  cursor: pointer;
  padding: 7px 12px;
  font-weight: 800;
}

.exercise-btn:hover {
  background: #1e293b;
}

.success-box {
  border-radius: 12px;
  margin-bottom: 18px;
  padding: 14px 18px;
  color: #166534;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
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

.exercise-modal {
  width: min(640px, 100%);
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
  margin-bottom: 18px;
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
  border: none;
  border-radius: 10px;
  background: #f1f5f9;
  color: #475569;
  cursor: pointer;
  font-weight: 800;
}

.close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.exercise-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  border-radius: 14px;
  background: #f8fafc;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.exercise-summary span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.exercise-summary strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 15px;
}

.saga-progress {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: #ffffff;
}

.saga-overall {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #475569;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.saga-status {
  font-size: 13px;
  font-weight: 800;
}

.saga-in_progress {
  color: #1d4ed8;
}

.saga-completed {
  color: #166534;
}

.saga-failed,
.saga-requires_manual_intervention {
  color: #991b1b;
}

.saga-rolling_back,
.saga-rolled_back {
  color: #b45309;
}

.saga-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.saga-step {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
  border-left: 3px solid #cbd5e1;
}

.saga-step-pending {
  border-left-color: #cbd5e1;
}

.saga-step-in_progress {
  border-left-color: #2563eb;
  background: #eff6ff;
}

.saga-step-completed {
  border-left-color: #16a34a;
  background: #f0fdf4;
}

.saga-step-failed {
  border-left-color: #dc2626;
  background: #fef2f2;
}

.saga-step-compensated {
  border-left-color: #d97706;
  background: #fffbeb;
}

.saga-step-name {
  font-weight: 800;
  color: #0f172a;
  font-size: 14px;
}

.saga-step-status {
  font-weight: 800;
  font-size: 12px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.saga-step-error {
  grid-column: 1 / -1;
  font-size: 12px;
  color: #991b1b;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.secondary-btn,
.submit-btn {
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
  padding: 10px 16px;
}

.secondary-btn {
  background: #f1f5f9;
  color: #475569;
}

.submit-btn {
  background: #0f172a;
  color: #fff;
}

.submit-btn:disabled,
.secondary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 900px) {
  .page-header,
  .panel-head {
    flex-direction: column;
  }

  .summary-grid,
  .exercise-summary {
    grid-template-columns: 1fr;
  }
}
</style>
