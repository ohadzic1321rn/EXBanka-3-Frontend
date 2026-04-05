<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { clientOrderApi, employeeOrderApi } from '../api/order'
import type { CreateOrderPayload, OrderType } from '../api/order'
import { clientAccountApi } from '../api/clientAccount'
import { accountApi } from '../api/account'
import { useClientAuthStore } from '../stores/clientAuth'
import { useAuthStore } from '../stores/auth'
import type { ListingItem } from '../api/market'

// ---------------------------------------------------------------------------
// Props / emits
// ---------------------------------------------------------------------------

const props = withDefaults(defineProps<{
  listing: ListingItem
  userType: 'client' | 'employee'
  direction?: 'buy' | 'sell'
  maxQuantity?: number
  preselectedAccountId?: number
}>(), {
  direction: 'buy',
  maxQuantity: undefined,
  preselectedAccountId: undefined,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submitted'): void
}>()

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface AccountOption {
  id: number
  label: string
  balance: number
}

const clientAuth = useClientAuthStore()
const employeeAuth = useAuthStore()

const accounts = ref<AccountOption[]>([])
const accountsLoading = ref(false)

// Form fields
const quantity = ref(1)
const orderType = ref<OrderType>('market')
const limitValue = ref<number | null>(null)
const stopValue = ref<number | null>(null)
const isAON = ref(false)
const isMargin = ref(false)
const afterHours = ref(false)
const selectedAccountId = ref<number | null>(null)
const contractSize = ref(1)

// UI state
const step = ref<'form' | 'confirm'>('form')
const submitting = ref(false)
const errorMsg = ref('')

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const needsLimit = computed(() => orderType.value === 'limit' || orderType.value === 'stop_limit')
const needsStop = computed(() => orderType.value === 'stop' || orderType.value === 'stop_limit')

const displayPrice = computed(() => {
  if (orderType.value === 'limit' || orderType.value === 'stop_limit') {
    return limitValue.value ?? (props.direction === 'sell' ? props.listing.bid : props.listing.ask)
  }
  return props.direction === 'sell' ? props.listing.bid : props.listing.ask
})

const approxTotal = computed(() =>
  Math.round(contractSize.value * displayPrice.value * quantity.value * 100) / 100
)

const approxTotalFormatted = computed(() =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(approxTotal.value)
)

const selectedAccount = computed(() =>
  accounts.value.find((a) => a.id === selectedAccountId.value) ?? null
)

const isAfterHoursWarning = computed(() => afterHours.value)

// ---------------------------------------------------------------------------
// Accounts loader
// ---------------------------------------------------------------------------

async function loadAccounts() {
  accountsLoading.value = true
  try {
    if (props.userType === 'client') {
      const clientId = clientAuth.client?.id
      if (!clientId) return
      const res = await clientAccountApi.listByClient(clientId)
      const items: any[] = res.data?.accounts ?? res.data ?? []
      accounts.value = items
        .filter((a: any) => a.currencyKod === 'RSD' && a.status === 'aktivan')
        .map((a: any) => ({
          id: Number(a.id),
          label: `${a.naziv || a.brojRacuna} (RSD ${Number(a.raspolozivoStanje).toFixed(2)})`,
          balance: Number(a.raspolozivoStanje),
        }))
    } else {
      // Employee: search active accounts (filter RSD client-side)
      const res = await accountApi.listAll({ status: 'aktivan' })
      const items: any[] = res.data?.accounts ?? res.data?.content ?? res.data ?? []
      accounts.value = items
        .filter((a: any) => a.currencyKod === 'RSD')
        .map((a: any) => ({
          id: Number(a.id),
          label: `${a.naziv || a.brojRacuna} (RSD ${Number(a.raspolozivoStanje).toFixed(2)})`,
          balance: Number(a.raspolozivoStanje),
        }))
    }
    if (props.preselectedAccountId) {
      selectedAccountId.value = props.preselectedAccountId
    } else if (accounts.value.length > 0) {
      selectedAccountId.value = accounts.value[0].id
    }
  } catch {
    // Non-fatal — user can still enter account manually if needed
  } finally {
    accountsLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function goToConfirm() {
  errorMsg.value = ''
  if (quantity.value < 1) {
    errorMsg.value = 'Količina mora biti najmanje 1.'
    return
  }
  if (props.maxQuantity !== undefined && quantity.value > props.maxQuantity) {
    errorMsg.value = `Maksimalna količina je ${props.maxQuantity}.`
    return
  }
  if ((needsLimit.value) && (!limitValue.value || limitValue.value <= 0)) {
    errorMsg.value = 'Unesite limit vrednost.'
    return
  }
  if ((needsStop.value) && (!stopValue.value || stopValue.value <= 0)) {
    errorMsg.value = 'Unesite stop vrednost.'
    return
  }
  if (!selectedAccountId.value) {
    errorMsg.value = 'Izaberite račun.'
    return
  }
  step.value = 'confirm'
}

function backToForm() {
  step.value = 'form'
}

async function submitOrder() {
  if (!selectedAccountId.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const payload: CreateOrderPayload = {
      assetTicker: props.listing.ticker,
      orderType: orderType.value,
      direction: props.direction,
      quantity: quantity.value,
      contractSize: contractSize.value,
      limitValue: needsLimit.value ? limitValue.value : null,
      stopValue: needsStop.value ? stopValue.value : null,
      isAON: isAON.value,
      isMargin: isMargin.value,
      accountId: selectedAccountId.value,
      afterHours: afterHours.value,
    }
    if (props.userType === 'client') {
      await clientOrderApi.createOrder(payload)
    } else {
      await employeeOrderApi.createOrder(payload)
    }
    emit('submitted')
  } catch (err: any) {
    const msg = err?.response?.data?.message ?? err?.message ?? 'Greška pri kreiranju naloga.'
    errorMsg.value = msg
    step.value = 'form'
  } finally {
    submitting.value = false
  }
}

onMounted(loadAccounts)
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-box" role="dialog" aria-modal="true">
      <!-- Header -->
      <div class="modal-header">
        <div>
          <span class="ticker-pill">{{ listing.ticker }}</span>
          <h2>{{ direction === 'sell' ? 'Prodaj' : 'Kupi' }} — {{ listing.name }}</h2>
        </div>
        <button class="close-btn" @click="emit('close')" aria-label="Zatvori">✕</button>
      </div>

      <!-- Current price row -->
      <div class="price-row">
        <span>Ask: <strong>{{ listing.ask.toFixed(2) }} {{ listing.exchange.currency }}</strong></span>
        <span>Bid: <strong>{{ listing.bid.toFixed(2) }} {{ listing.exchange.currency }}</strong></span>
        <span>Cena: <strong>{{ listing.price.toFixed(2) }} {{ listing.exchange.currency }}</strong></span>
      </div>

      <!-- After-hours warning -->
      <div v-if="isAfterHoursWarning" class="warning-box">
        Nalog se postavlja van radnog vremena berze. Izvršenje je moguće tek kada berza otvori.
      </div>

      <!-- Error -->
      <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>

      <!-- ================================================================
           STEP 1: FORM
           ================================================================ -->
      <template v-if="step === 'form'">
        <div class="form-grid">
          <!-- Order type -->
          <div class="field">
            <label>Tip naloga</label>
            <select v-model="orderType">
              <option value="market">Market</option>
              <option value="limit">Limit</option>
              <option value="stop">Stop</option>
              <option value="stop_limit">Stop-Limit</option>
            </select>
          </div>

          <!-- Quantity -->
          <div class="field">
            <label>Količina{{ maxQuantity !== undefined ? ` (max ${maxQuantity})` : '' }}</label>
            <input type="number" v-model.number="quantity" min="1" :max="maxQuantity ?? undefined" step="1" />
          </div>

          <!-- Contract size (advanced) -->
          <div class="field">
            <label>Veličina ugovora</label>
            <input type="number" v-model.number="contractSize" min="1" step="1" />
          </div>

          <!-- Limit value -->
          <div v-if="needsLimit" class="field">
            <label>Limit vrednost ({{ listing.exchange.currency }})</label>
            <input type="number" v-model.number="limitValue" min="0.01" step="0.01" placeholder="0.00" />
          </div>

          <!-- Stop value -->
          <div v-if="needsStop" class="field">
            <label>Stop vrednost ({{ listing.exchange.currency }})</label>
            <input type="number" v-model.number="stopValue" min="0.01" step="0.01" placeholder="0.00" />
          </div>

          <!-- Account -->
          <div class="field field-full">
            <label>Račun (RSD)</label>
            <div v-if="accountsLoading" class="loading-hint">Učitavam račune...</div>
            <select v-else v-model.number="selectedAccountId">
              <option :value="null" disabled>Izaberite račun</option>
              <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
                {{ acc.label }}
              </option>
            </select>
            <p v-if="accounts.length === 0 && !accountsLoading" class="field-hint">
              Nema aktivnih RSD računa.
            </p>
          </div>

          <!-- Toggles -->
          <div class="field toggle-field">
            <label class="toggle-label">
              <input type="checkbox" v-model="isAON" />
              <span>AON (sve ili ništa)</span>
            </label>
          </div>
          <div class="field toggle-field">
            <label class="toggle-label">
              <input type="checkbox" v-model="isMargin" />
              <span>Margin nalog</span>
            </label>
          </div>
          <div class="field toggle-field">
            <label class="toggle-label">
              <input type="checkbox" v-model="afterHours" />
              <span>Van radnog vremena (after-hours)</span>
            </label>
          </div>
        </div>

        <!-- Approx price -->
        <div class="approx-row">
          <span>Procenjena vrednost</span>
          <strong>≈ {{ approxTotalFormatted }} {{ listing.exchange.currency }}</strong>
          <span class="approx-hint">= {{ contractSize }} × {{ displayPrice.toFixed(2) }} × {{ quantity }}</span>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" @click="emit('close')">Otkaži</button>
          <button class="btn-primary" @click="goToConfirm">Nastavi</button>
        </div>
      </template>

      <!-- ================================================================
           STEP 2: CONFIRM
           ================================================================ -->
      <template v-else>
        <div class="confirm-summary">
          <h3>Potvrda naloga</h3>
          <ul class="summary-list">
            <li><span>Hartija</span><strong>{{ listing.ticker }} — {{ listing.name }}</strong></li>
            <li><span>Smer</span><strong :class="direction === 'sell' ? 'sell-label' : 'buy-label'">{{ direction === 'sell' ? 'SELL' : 'BUY' }}</strong></li>
            <li><span>Tip naloga</span><strong>{{ orderType.toUpperCase().replace('_', '-') }}</strong></li>
            <li><span>Količina</span><strong>{{ quantity }}</strong></li>
            <li><span>Veličina ugovora</span><strong>{{ contractSize }}</strong></li>
            <li v-if="needsLimit"><span>Limit</span><strong>{{ limitValue }} {{ listing.exchange.currency }}</strong></li>
            <li v-if="needsStop"><span>Stop</span><strong>{{ stopValue }} {{ listing.exchange.currency }}</strong></li>
            <li><span>Račun</span><strong>{{ selectedAccount?.label ?? selectedAccountId }}</strong></li>
            <li><span>AON</span><strong>{{ isAON ? 'Da' : 'Ne' }}</strong></li>
            <li><span>Margin</span><strong>{{ isMargin ? 'Da' : 'Ne' }}</strong></li>
            <li><span>After-hours</span><strong>{{ afterHours ? 'Da' : 'Ne' }}</strong></li>
            <li class="total-row"><span>Procenjena vrednost</span><strong>≈ {{ approxTotalFormatted }} {{ listing.exchange.currency }}</strong></li>
          </ul>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" :disabled="submitting" @click="backToForm">Nazad</button>
          <button
            :class="direction === 'sell' ? 'btn-sell' : 'btn-buy'"
            :disabled="submitting"
            @click="submitOrder"
          >
            {{ submitting ? 'Slanje...' : direction === 'sell' ? 'Potvrdi prodaju' : 'Potvrdi kupovinu' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-box {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.2);
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.modal-header h2 {
  margin: 6px 0 0;
  font-size: 20px;
  color: #0f172a;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #64748b;
  padding: 4px 8px;
  border-radius: 6px;
  line-height: 1;
}
.close-btn:hover { background: #f1f5f9; }

.ticker-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.price-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 0;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 18px;
  font-size: 13px;
  color: #475569;
}
.price-row strong { color: #0f172a; }

.warning-box {
  background: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #92400e;
  margin-bottom: 14px;
}

.error-box {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #b91c1c;
  margin-bottom: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 18px;
}

.field { display: flex; flex-direction: column; gap: 5px; }
.field-full { grid-column: 1 / -1; }

.field label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field input,
.field select {
  padding: 9px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  color: #0f172a;
  background: #fff;
}
.field input:focus,
.field select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.field-hint {
  font-size: 12px;
  color: #ef4444;
  margin: 2px 0 0;
}

.loading-hint {
  font-size: 13px;
  color: #64748b;
  padding: 9px 0;
}

.toggle-field { justify-content: center; }
.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  font-weight: normal !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
}
.toggle-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
  cursor: pointer;
}

.approx-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 18px;
}
.approx-row span { font-size: 13px; color: #0369a1; }
.approx-row strong { font-size: 18px; font-weight: 800; color: #0f172a; margin-left: auto; }
.approx-hint { font-size: 11px; color: #64748b; margin-left: 4px; }

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-weight: 600;
  cursor: pointer;
  font-size: 14px;
}
.btn-secondary:hover:not(:disabled) { background: #f1f5f9; }

.btn-primary {
  padding: 10px 24px;
  border: none;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  font-size: 14px;
}
.btn-primary:hover { background: #1e293b; }

.btn-buy {
  padding: 10px 28px;
  border: none;
  border-radius: 10px;
  background: #16a34a;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  font-size: 14px;
}
.btn-buy:hover:not(:disabled) { background: #15803d; }
.btn-buy:disabled,
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Confirm step */
.confirm-summary h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #0f172a;
}

.summary-list {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}
.summary-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  font-size: 14px;
  border-bottom: 1px solid #f1f5f9;
}
.summary-list li:last-child { border-bottom: none; }
.summary-list span { color: #64748b; }
.summary-list strong { color: #0f172a; }
.buy-label { color: #16a34a; }
.sell-label { color: #dc2626; }
.total-row { background: #f0fdf4; }
.total-row strong { font-size: 16px; color: #15803d; }

.btn-sell {
  padding: 10px 28px;
  border: none;
  border-radius: 10px;
  background: #dc2626;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  font-size: 14px;
}
.btn-sell:hover:not(:disabled) { background: #b91c1c; }
.btn-sell:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
