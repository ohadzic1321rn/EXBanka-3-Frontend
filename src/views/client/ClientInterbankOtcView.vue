<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  interbankOtcApi,
  type InterbankPublicStock,
  type InterbankPublicStockSeller,
  type InterbankNegotiation,
  type InterbankOptionContract,
  type CreateInterbankNegotiationPayload,
  type CounterInterbankNegotiationPayload,
} from '../../api/interbankOtc'

type TabKey = 'stocks' | 'negotiations' | 'contracts'

const activeTab = ref<TabKey>('stocks')

// ─── Public stocks ─────────────────────────────────────────────────────
const stocks = ref<InterbankPublicStock[]>([])
const stocksSource = ref<'cache' | 'live'>('cache')
const stocksLoading = ref(false)
const stocksError = ref('')
const partnerErrors = ref<Record<string, string>>({})
const partnerStale = ref<Record<string, boolean>>({})

async function loadStocks(live = false) {
  stocksLoading.value = true
  stocksError.value = ''
  try {
    const res = await interbankOtcApi.listPublicStocks(live)
    stocks.value = res.data.stocks ?? []
    stocksSource.value = res.data.source
    partnerErrors.value = res.data.partnerErrors ?? {}
    partnerStale.value = res.data.partnerStale ?? {}
  } catch (e: any) {
    stocksError.value = e?.response?.data?.message || 'Greška pri učitavanju javnih akcija.'
  } finally {
    stocksLoading.value = false
  }
}

// ─── Negotiations ──────────────────────────────────────────────────────
const negotiations = ref<InterbankNegotiation[]>([])
const negotiationsLoading = ref(false)
const negotiationsError = ref('')
const negotiationsFilter = ref<'' | 'buyer' | 'seller'>('')
const includeClosed = ref(false)

async function loadNegotiations() {
  negotiationsLoading.value = true
  negotiationsError.value = ''
  try {
    const res = await interbankOtcApi.listNegotiations(negotiationsFilter.value, includeClosed.value)
    negotiations.value = res.data.negotiations ?? []
  } catch (e: any) {
    negotiationsError.value = e?.response?.data?.message || 'Greška pri učitavanju pregovora.'
  } finally {
    negotiationsLoading.value = false
  }
}

// new negotiation form
const showOfferForm = ref(false)
const offerSeller = ref<InterbankPublicStockSeller | null>(null)
const offerTicker = ref('')
const offerForm = ref({
  amount: '',
  pricePerUnitAmount: '',
  pricePerUnitCurrency: 'USD',
  premiumAmount: '',
  premiumCurrency: 'USD',
  settlementDate: '',
})
const offerError = ref('')
const offerSubmitting = ref(false)

function openOfferForm(stock: InterbankPublicStock, seller: InterbankPublicStockSeller) {
  offerSeller.value = seller
  offerTicker.value = stock.ticker
  const defaultSettlement = new Date()
  defaultSettlement.setDate(defaultSettlement.getDate() + 30)
  offerForm.value = {
    amount: '',
    pricePerUnitAmount: '',
    pricePerUnitCurrency: 'USD',
    premiumAmount: '',
    premiumCurrency: 'USD',
    settlementDate: defaultSettlement.toISOString().slice(0, 10),
  }
  offerError.value = ''
  showOfferForm.value = true
}

function closeOfferForm() {
  showOfferForm.value = false
  offerSeller.value = null
}

async function submitOffer() {
  if (!offerSeller.value) return
  const amount = Number(offerForm.value.amount)
  const price = Number(offerForm.value.pricePerUnitAmount)
  const premium = Number(offerForm.value.premiumAmount)
  if (!Number.isFinite(amount) || amount <= 0) { offerError.value = 'Količina mora biti pozitivna.'; return }
  if (amount > offerSeller.value.amount) { offerError.value = 'Količina prelazi dostupnu kod prodavca.'; return }
  if (!Number.isFinite(price) || price <= 0) { offerError.value = 'Cena po akciji mora biti pozitivna.'; return }
  if (!Number.isFinite(premium) || premium < 0) { offerError.value = 'Premija ne može biti negativna.'; return }
  if (!offerForm.value.settlementDate) { offerError.value = 'Settlement date je obavezan.'; return }

  const payload: CreateInterbankNegotiationPayload = {
    sellerId: {
      routingNumber: offerSeller.value.bankRoutingNumber,
      id: offerSeller.value.sellerId,
    },
    stock: { ticker: offerTicker.value },
    settlementDate: offerForm.value.settlementDate,
    pricePerUnit: { currency: offerForm.value.pricePerUnitCurrency, amount: price },
    premium: { currency: offerForm.value.premiumCurrency, amount: premium },
    amount,
  }
  offerSubmitting.value = true
  offerError.value = ''
  try {
    await interbankOtcApi.createNegotiation(payload)
    closeOfferForm()
    activeTab.value = 'negotiations'
    await loadNegotiations()
  } catch (e: any) {
    offerError.value = e?.response?.data?.message || 'Greška pri slanju ponude.'
  } finally {
    offerSubmitting.value = false
  }
}

// counter / accept / close actions
const counterTarget = ref<InterbankNegotiation | null>(null)
const counterForm = ref({
  amount: '',
  pricePerUnitAmount: '',
  premiumAmount: '',
  settlementDate: '',
})
const counterError = ref('')
const counterSubmitting = ref(false)

function openCounterForm(neg: InterbankNegotiation) {
  counterTarget.value = neg
  counterForm.value = {
    amount: String(neg.amount),
    pricePerUnitAmount: String(neg.pricePerUnit.amount),
    premiumAmount: String(neg.premium.amount),
    settlementDate: neg.settlementDate,
  }
  counterError.value = ''
}

function closeCounterForm() {
  counterTarget.value = null
}

async function submitCounter() {
  if (!counterTarget.value) return
  const target = counterTarget.value
  const payload: CounterInterbankNegotiationPayload = {
    stock: { ticker: target.stock.ticker },
    settlementDate: counterForm.value.settlementDate,
    pricePerUnit: { currency: target.pricePerUnit.currency, amount: Number(counterForm.value.pricePerUnitAmount) },
    premium: { currency: target.premium.currency, amount: Number(counterForm.value.premiumAmount) },
    amount: Number(counterForm.value.amount),
  }
  counterSubmitting.value = true
  counterError.value = ''
  try {
    await interbankOtcApi.counterNegotiation(target.negotiationRoutingNumber, target.negotiationId, payload)
    closeCounterForm()
    await loadNegotiations()
  } catch (e: any) {
    counterError.value = e?.response?.data?.message || 'Greška pri slanju kontra-ponude.'
  } finally {
    counterSubmitting.value = false
  }
}

const acceptingId = ref('')
async function acceptNegotiation(neg: InterbankNegotiation) {
  if (!confirm(`Prihvatiti ovaj pregovor za ${neg.amount} ${neg.stock.ticker}?`)) return
  acceptingId.value = neg.negotiationId
  try {
    await interbankOtcApi.acceptNegotiation(neg.negotiationRoutingNumber, neg.negotiationId)
    await Promise.all([loadNegotiations(), loadContracts()])
  } catch (e: any) {
    alert(e?.response?.data?.message || 'Greška pri prihvatanju pregovora.')
  } finally {
    acceptingId.value = ''
  }
}

const closingId = ref('')
async function closeNegotiation(neg: InterbankNegotiation) {
  if (!confirm('Zatvoriti ovaj pregovor?')) return
  closingId.value = neg.negotiationId
  try {
    await interbankOtcApi.closeNegotiation(neg.negotiationRoutingNumber, neg.negotiationId)
    await loadNegotiations()
  } catch (e: any) {
    alert(e?.response?.data?.message || 'Greška pri zatvaranju pregovora.')
  } finally {
    closingId.value = ''
  }
}

// ─── Option contracts ──────────────────────────────────────────────────
const contracts = ref<InterbankOptionContract[]>([])
const contractsLoading = ref(false)
const contractsError = ref('')

async function loadContracts() {
  contractsLoading.value = true
  contractsError.value = ''
  try {
    const res = await interbankOtcApi.listOptionContracts()
    contracts.value = res.data.contracts ?? []
  } catch (e: any) {
    contractsError.value = e?.response?.data?.message || 'Greška pri učitavanju opcionih ugovora.'
  } finally {
    contractsLoading.value = false
  }
}

const exercisingId = ref(0)
const exerciseFeedback = ref('')
const exerciseFeedbackClass = ref<'ok' | 'err'>('ok')

async function exerciseContract(c: InterbankOptionContract) {
  if (!confirm(`Iskoristiti opciju za ${c.amount} ${c.stockTicker}? Cena: ${c.pricePerUnit.amount * c.amount} ${c.pricePerUnit.currency}.`)) return
  exercisingId.value = c.id
  exerciseFeedback.value = ''
  try {
    const res = await interbankOtcApi.exerciseOptionContract(c.id)
    if (res.data.status === 'committed') {
      exerciseFeedback.value = 'Opcija uspešno izvršena.'
      exerciseFeedbackClass.value = 'ok'
    } else {
      exerciseFeedback.value = res.data.message || `Izvršavanje opcije: ${res.data.status}`
      exerciseFeedbackClass.value = 'err'
    }
    await loadContracts()
  } catch (e: any) {
    exerciseFeedback.value = e?.response?.data?.message || 'Greška pri izvršavanju opcije.'
    exerciseFeedbackClass.value = 'err'
  } finally {
    exercisingId.value = 0
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────
const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qtyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

function fmt(v: number) { return moneyFmt.format(v) }
function fmtQty(v: number) { return qtyFmt.format(v) }
function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('sr-RS')
}

const partnerErrorEntries = computed(() => Object.entries(partnerErrors.value))
const hasPartnerStale = computed(() => Object.keys(partnerStale.value).length > 0)

onMounted(async () => {
  await Promise.all([loadStocks(), loadNegotiations(), loadContracts()])
})
</script>

<template>
  <div class="ib-page">
    <header class="ib-header">
      <h1>Cross-bank OTC</h1>
      <p class="ib-sub">
        Tržište javnih akcija, pregovori i opcioni ugovori između banaka u sistemu.
      </p>
    </header>

    <nav class="ib-tabs">
      <button :class="{ active: activeTab === 'stocks' }" @click="activeTab = 'stocks'">
        Javne akcije banaka
      </button>
      <button :class="{ active: activeTab === 'negotiations' }" @click="activeTab = 'negotiations'">
        Pregovori
        <span v-if="negotiations.length" class="ib-badge">{{ negotiations.length }}</span>
      </button>
      <button :class="{ active: activeTab === 'contracts' }" @click="activeTab = 'contracts'">
        Opcioni ugovori
        <span v-if="contracts.length" class="ib-badge">{{ contracts.length }}</span>
      </button>
    </nav>

    <!-- ─── PUBLIC STOCKS ─────────────────────────────────────────── -->
    <section v-if="activeTab === 'stocks'" class="ib-card">
      <div class="ib-card-head">
        <div>
          <h2>Javne akcije partnerskih banaka</h2>
          <div class="ib-meta">
            Izvor: <strong>{{ stocksSource === 'cache' ? 'keš' : 'uživo' }}</strong>
            <span v-if="hasPartnerStale" class="ib-warn">· deo podataka može biti zastareo</span>
          </div>
        </div>
        <button class="ib-btn ib-btn-sec" :disabled="stocksLoading" @click="loadStocks(true)">
          {{ stocksLoading ? 'Osvežavam…' : 'Osveži uživo' }}
        </button>
      </div>

      <div v-if="partnerErrorEntries.length" class="ib-warn-box">
        <strong>Neke banke nedostupne:</strong>
        <ul>
          <li v-for="[routing, err] in partnerErrorEntries" :key="routing">
            Banka {{ routing }} — {{ err }}
          </li>
        </ul>
      </div>

      <div v-if="stocksError" class="ib-error">{{ stocksError }}</div>

      <div v-if="!stocksLoading && stocks.length === 0" class="ib-empty">
        Nema javnih akcija u partnerskim bankama.
      </div>

      <table v-else class="ib-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Prodavac (banka)</th>
            <th>Dostupna količina</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="stock in stocks" :key="stock.ticker">
            <tr v-for="seller in stock.sellers" :key="`${stock.ticker}-${seller.bankRoutingNumber}-${seller.sellerId}`">
              <td class="ib-mono">{{ stock.ticker }}</td>
              <td>
                <span class="ib-chip">{{ seller.bankDisplayName || `Banka ${seller.bankRoutingNumber}` }}</span>
                <span class="ib-mono ib-faded">· {{ seller.sellerId }}</span>
              </td>
              <td>{{ fmtQty(seller.amount) }}</td>
              <td>
                <button class="ib-btn ib-btn-primary" @click="openOfferForm(stock, seller)">
                  Pošalji ponudu
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>

    <!-- ─── NEGOTIATIONS ──────────────────────────────────────────── -->
    <section v-if="activeTab === 'negotiations'" class="ib-card">
      <div class="ib-card-head">
        <h2>Moji pregovori</h2>
        <div class="ib-filters">
          <select v-model="negotiationsFilter" @change="loadNegotiations()">
            <option value="">Svi</option>
            <option value="buyer">Kao kupac</option>
            <option value="seller">Kao prodavac</option>
          </select>
          <label class="ib-check">
            <input type="checkbox" v-model="includeClosed" @change="loadNegotiations()" />
            Prikaži zatvorene
          </label>
          <button class="ib-btn ib-btn-sec" :disabled="negotiationsLoading" @click="loadNegotiations()">
            Osveži
          </button>
        </div>
      </div>

      <div v-if="negotiationsError" class="ib-error">{{ negotiationsError }}</div>
      <div v-if="!negotiationsLoading && negotiations.length === 0" class="ib-empty">
        Nema pregovora.
      </div>

      <table v-else class="ib-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Uloga</th>
            <th>Druga strana</th>
            <th>Količina</th>
            <th>Cena</th>
            <th>Premija</th>
            <th>Settlement</th>
            <th>Status</th>
            <th>Poslednju izmenu napravio</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="neg in negotiations" :key="`${neg.negotiationRoutingNumber}-${neg.negotiationId}`">
            <td class="ib-mono">{{ neg.stock.ticker }}</td>
            <td><span class="ib-chip">{{ neg.localRole === 'buyer' ? 'Kupac' : 'Prodavac' }}</span></td>
            <td>
              <span class="ib-chip">Banka {{ neg.counterpartyRoutingNumber }}</span>
            </td>
            <td>{{ fmtQty(neg.amount) }}</td>
            <td>{{ fmt(neg.pricePerUnit.amount) }} {{ neg.pricePerUnit.currency }}</td>
            <td>{{ fmt(neg.premium.amount) }} {{ neg.premium.currency }}</td>
            <td>{{ neg.settlementDate }}</td>
            <td>
              <span :class="['ib-status', neg.isOngoing ? 'ib-status-ongoing' : 'ib-status-closed']">
                {{ neg.isOngoing ? 'U toku' : 'Zatvoren' }}
              </span>
            </td>
            <td>
              {{ neg.lastModifiedBy.routingNumber === neg.buyerId.routingNumber && neg.lastModifiedBy.id === neg.buyerId.id ? 'Kupac' : 'Prodavac' }}
            </td>
            <td v-if="neg.isOngoing" class="ib-actions">
              <button class="ib-btn ib-btn-sec" @click="openCounterForm(neg)">Kontra</button>
              <button
                class="ib-btn ib-btn-primary"
                :disabled="acceptingId === neg.negotiationId || (neg.lastModifiedBy.routingNumber === (neg.localRole === 'buyer' ? neg.buyerId.routingNumber : neg.sellerId.routingNumber) && neg.lastModifiedBy.id === (neg.localRole === 'buyer' ? neg.buyerId.id : neg.sellerId.id))"
                @click="acceptNegotiation(neg)"
              >
                {{ acceptingId === neg.negotiationId ? '…' : 'Prihvati' }}
              </button>
              <button class="ib-btn ib-btn-danger" :disabled="closingId === neg.negotiationId" @click="closeNegotiation(neg)">
                {{ closingId === neg.negotiationId ? '…' : 'Zatvori' }}
              </button>
            </td>
            <td v-else></td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- ─── OPTION CONTRACTS ──────────────────────────────────────── -->
    <section v-if="activeTab === 'contracts'" class="ib-card">
      <div class="ib-card-head">
        <h2>Cross-bank opcioni ugovori</h2>
        <button class="ib-btn ib-btn-sec" :disabled="contractsLoading" @click="loadContracts()">Osveži</button>
      </div>

      <div v-if="contractsError" class="ib-error">{{ contractsError }}</div>
      <div v-if="exerciseFeedback" :class="['ib-feedback', exerciseFeedbackClass === 'ok' ? 'ib-feedback-ok' : 'ib-feedback-err']">
        {{ exerciseFeedback }}
      </div>
      <div v-if="!contractsLoading && contracts.length === 0" class="ib-empty">
        Nemate cross-bank opcione ugovore.
      </div>

      <table v-else class="ib-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Prodavac (banka)</th>
            <th>Količina</th>
            <th>Cena izvršenja</th>
            <th>Premija</th>
            <th>Settlement</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in contracts" :key="c.id">
            <td class="ib-mono">{{ c.stockTicker }}</td>
            <td>
              <span class="ib-chip">Banka {{ c.sellerRoutingNumber }}</span>
              <span class="ib-mono ib-faded">· {{ c.sellerId }}</span>
            </td>
            <td>{{ fmtQty(c.amount) }}</td>
            <td>{{ fmt(c.pricePerUnit.amount) }} {{ c.pricePerUnit.currency }}</td>
            <td>{{ fmt(c.premium.amount) }} {{ c.premium.currency }}</td>
            <td>{{ c.settlementDate }}</td>
            <td>
              <span :class="['ib-status', `ib-status-${c.status}`]">{{ c.status }}</span>
            </td>
            <td>
              <button
                v-if="c.status === 'valid'"
                class="ib-btn ib-btn-primary"
                :disabled="exercisingId === c.id"
                @click="exerciseContract(c)"
              >
                {{ exercisingId === c.id ? 'Izvršavam…' : 'Iskoristi' }}
              </button>
              <span v-else class="ib-faded">—</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="ib-meta" style="margin-top:8px">
        Posl. ažuriranje: {{ contracts[0] ? fmtDate(contracts[0].updatedAt) : '—' }}
      </div>
    </section>

    <!-- ─── OFFER MODAL ───────────────────────────────────────────── -->
    <div v-if="showOfferForm && offerSeller" class="ib-modal-bg" @click.self="closeOfferForm">
      <div class="ib-modal">
        <h3>Nova ponuda · {{ offerTicker }}</h3>
        <div class="ib-meta">
          Prodavac: <span class="ib-chip">{{ offerSeller.bankDisplayName }}</span>
          <span class="ib-mono ib-faded">· {{ offerSeller.sellerId }}</span>
          <span> · dostupno: {{ fmtQty(offerSeller.amount) }}</span>
        </div>

        <div class="ib-field">
          <label>Količina</label>
          <input type="number" v-model="offerForm.amount" :max="offerSeller.amount" min="1" />
        </div>
        <div class="ib-row">
          <div class="ib-field">
            <label>Cena po akciji</label>
            <input type="number" v-model="offerForm.pricePerUnitAmount" min="0.01" step="0.01" />
          </div>
          <div class="ib-field ib-field-sm">
            <label>Valuta</label>
            <select v-model="offerForm.pricePerUnitCurrency">
              <option>USD</option><option>EUR</option><option>RSD</option>
            </select>
          </div>
        </div>
        <div class="ib-row">
          <div class="ib-field">
            <label>Premija (ukupno)</label>
            <input type="number" v-model="offerForm.premiumAmount" min="0" step="0.01" />
          </div>
          <div class="ib-field ib-field-sm">
            <label>Valuta</label>
            <select v-model="offerForm.premiumCurrency">
              <option>USD</option><option>EUR</option><option>RSD</option>
            </select>
          </div>
        </div>
        <div class="ib-field">
          <label>Settlement date</label>
          <input type="date" v-model="offerForm.settlementDate" />
        </div>

        <div v-if="offerError" class="ib-error">{{ offerError }}</div>
        <div class="ib-modal-actions">
          <button class="ib-btn ib-btn-sec" @click="closeOfferForm">Otkaži</button>
          <button class="ib-btn ib-btn-primary" :disabled="offerSubmitting" @click="submitOffer">
            {{ offerSubmitting ? 'Šaljem…' : 'Pošalji ponudu' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ─── COUNTER MODAL ─────────────────────────────────────────── -->
    <div v-if="counterTarget" class="ib-modal-bg" @click.self="closeCounterForm">
      <div class="ib-modal">
        <h3>Kontra-ponuda · {{ counterTarget.stock.ticker }}</h3>
        <div class="ib-field">
          <label>Količina</label>
          <input type="number" v-model="counterForm.amount" min="1" />
        </div>
        <div class="ib-field">
          <label>Cena po akciji ({{ counterTarget.pricePerUnit.currency }})</label>
          <input type="number" v-model="counterForm.pricePerUnitAmount" min="0.01" step="0.01" />
        </div>
        <div class="ib-field">
          <label>Premija ({{ counterTarget.premium.currency }})</label>
          <input type="number" v-model="counterForm.premiumAmount" min="0" step="0.01" />
        </div>
        <div class="ib-field">
          <label>Settlement date</label>
          <input type="date" v-model="counterForm.settlementDate" />
        </div>
        <div v-if="counterError" class="ib-error">{{ counterError }}</div>
        <div class="ib-modal-actions">
          <button class="ib-btn ib-btn-sec" @click="closeCounterForm">Otkaži</button>
          <button class="ib-btn ib-btn-primary" :disabled="counterSubmitting" @click="submitCounter">
            {{ counterSubmitting ? 'Šaljem…' : 'Pošalji kontra' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ib-page { padding: 32px; max-width: 1200px; margin: 0 auto; }
.ib-header { margin-bottom: 20px; }
.ib-header h1 { font-size: 28px; font-weight: 700; color: #0f172a; margin: 0; }
.ib-sub { color: #64748b; font-size: 14px; margin: 4px 0 0; }

.ib-tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; }
.ib-tabs button {
  padding: 10px 16px; background: none; border: none; cursor: pointer;
  font-size: 14px; font-weight: 600; color: #64748b;
  border-bottom: 2px solid transparent; transition: all 0.15s;
}
.ib-tabs button:hover { color: #0f172a; }
.ib-tabs button.active { color: #2563eb; border-bottom-color: #2563eb; }
.ib-badge {
  display: inline-block; padding: 2px 8px; margin-left: 6px;
  background: #e0e7ff; color: #3730a3; border-radius: 999px;
  font-size: 11px; font-weight: 700;
}

.ib-card {
  background: #fff; border-radius: 16px; padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
  border: 1px solid #e2e8f0;
}
.ib-card-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 16px; margin-bottom: 16px;
}
.ib-card-head h2 { font-size: 18px; color: #0f172a; margin: 0 0 4px; }
.ib-meta { font-size: 13px; color: #64748b; }
.ib-warn { color: #b45309; margin-left: 4px; }

.ib-filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ib-filters select, .ib-check {
  padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 13px; background: #fff;
}
.ib-check { display: flex; align-items: center; gap: 6px; cursor: pointer; }

.ib-table {
  width: 100%; border-collapse: collapse; font-size: 14px;
}
.ib-table th {
  text-align: left; padding: 10px 12px;
  background: #f8fafc; color: #475569; font-size: 12px;
  text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}
.ib-table td {
  padding: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;
}
.ib-table tr:hover td { background: #fafbfc; }

.ib-mono { font-family: 'SF Mono', ui-monospace, monospace; }
.ib-faded { color: #94a3b8; }

.ib-chip {
  display: inline-block; padding: 3px 10px; border-radius: 999px;
  background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 600;
}

.ib-status {
  display: inline-block; padding: 3px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
}
.ib-status-ongoing  { background: #fef9c3; color: #854d0e; }
.ib-status-closed   { background: #f1f5f9; color: #475569; }
.ib-status-valid    { background: #dcfce7; color: #166534; }
.ib-status-exercised{ background: #e0e7ff; color: #3730a3; }
.ib-status-expired  { background: #f1f5f9; color: #475569; }

.ib-actions { display: flex; gap: 6px; flex-wrap: wrap; }

.ib-btn {
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.15s;
}
.ib-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ib-btn-primary { background: #2563eb; color: #fff; }
.ib-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.ib-btn-sec { background: #f1f5f9; color: #475569; }
.ib-btn-sec:hover:not(:disabled) { background: #e2e8f0; }
.ib-btn-danger { background: #fef2f2; color: #b91c1c; }
.ib-btn-danger:hover:not(:disabled) { background: #fee2e2; }

.ib-warn-box {
  padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a;
  border-radius: 8px; color: #92400e; font-size: 13px; margin-bottom: 12px;
}
.ib-warn-box ul { margin: 4px 0 0; padding-left: 18px; }

.ib-error {
  padding: 10px 14px; background: #fef2f2; color: #dc2626;
  border-radius: 8px; font-size: 13px; margin-bottom: 12px;
}

.ib-feedback { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
.ib-feedback-ok  { background: #dcfce7; color: #166534; }
.ib-feedback-err { background: #fef2f2; color: #b91c1c; }

.ib-empty {
  text-align: center; padding: 32px; color: #94a3b8; font-size: 14px;
}

/* modal */
.ib-modal-bg {
  position: fixed; inset: 0; background: rgba(15,23,42,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 50;
}
.ib-modal {
  background: #fff; border-radius: 16px; padding: 24px;
  max-width: 480px; width: 90%;
  box-shadow: 0 20px 50px rgba(0,0,0,0.2);
}
.ib-modal h3 { font-size: 18px; margin: 0 0 12px; color: #0f172a; }
.ib-field { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.ib-field label { font-size: 12px; font-weight: 600; color: #475569; }
.ib-field input, .ib-field select {
  padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 14px;
}
.ib-row { display: flex; gap: 8px; }
.ib-row .ib-field { flex: 1; }
.ib-row .ib-field-sm { flex: 0 0 100px; }
.ib-modal-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
</style>
