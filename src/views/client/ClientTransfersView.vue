<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useClientAccountStore } from '../../stores/clientAccount'
import { useTransferStore } from '../../stores/transfer'
import { useClientAuthStore } from '../../stores/clientAuth'
import { transferApi } from '../../api/transfer'

const route = useRoute()
const clientAuthStore = useClientAuthStore()
const accountStore = useClientAccountStore()
const transferStore = useTransferStore()

const step = ref<'form' | 'confirm' | 'success'>('form')

const form = ref({
  fromAccountId: (route.query.fromAccountId as string) || '',
  toAccountId: '',
  iznos: '',
  svrha: '',
})

const lastCreated = ref<any>(null)
const exchangePreview = ref<{ outputAmount: number; rate: number } | null>(null)
const loadingPreview = ref(false)

const clientId = computed(() => String(clientAuthStore.client?.id ?? ''))

const fromAccount = computed(() =>
  accountStore.accounts.find(a => String(a.id) === form.value.fromAccountId) ?? null
)
const toAccount = computed(() =>
  accountStore.accounts.find(a => String(a.id) === form.value.toAccountId) ?? null
)

const isCrossCurrency = computed(() =>
  !!fromAccount.value && !!toAccount.value &&
  fromAccount.value.currencyKod !== toAccount.value.currencyKod
)

async function fetchExchangePreview() {
  if (!isCrossCurrency.value || !form.value.iznos || Number(form.value.iznos) <= 0) {
    exchangePreview.value = null
    return
  }
  loadingPreview.value = true
  try {
    const res = await transferApi.calculateExchange(
      fromAccount.value!.currencyKod,
      toAccount.value!.currencyKod,
      Number(form.value.iznos),
    )
    exchangePreview.value = {
      outputAmount: res.data.converted_amount ?? res.data.output_amount ?? 0,
      rate: res.data.rate ?? 0,
    }
  } catch {
    exchangePreview.value = null
  } finally {
    loadingPreview.value = false
  }
}

watch(
  () => [form.value.fromAccountId, form.value.toAccountId, form.value.iznos],
  fetchExchangePreview,
)

function goToConfirm() {
  if (!form.value.fromAccountId || !form.value.toAccountId || !form.value.iznos || !form.value.svrha) return
  if (form.value.fromAccountId === form.value.toAccountId) return
  if (Number(form.value.iznos) <= 0) return
  step.value = 'confirm'
}

async function handleSubmit() {
  try {
    const result = await transferStore.createTransfer({
      racunPosiljaocaId: Number(form.value.fromAccountId),
      racunPrimaocaId: Number(form.value.toAccountId),
      iznos: Number(form.value.iznos),
      svrha: form.value.svrha,
    })
    lastCreated.value = result
    step.value = 'success'
    // refresh history
    await transferStore.fetchByClient(clientId.value)
  } catch {
    step.value = 'form'
  }
}

function startNew() {
  form.value = { fromAccountId: '', toAccountId: '', iznos: '', svrha: '' }
  exchangePreview.value = null
  step.value = 'form'
}

// History filters
const historyFilter = ref({ status: '', dateFrom: '', dateTo: '' })

async function applyHistoryFilter() {
  transferStore.page = 1
  await transferStore.fetchByClient(clientId.value, {
    status: historyFilter.value.status || undefined,
    dateFrom: historyFilter.value.dateFrom || undefined,
    dateTo: historyFilter.value.dateTo || undefined,
  })
}

async function prevPage() {
  if (transferStore.page > 1) {
    transferStore.page--
    await transferStore.fetchByClient(clientId.value, {
      status: historyFilter.value.status || undefined,
      dateFrom: historyFilter.value.dateFrom || undefined,
      dateTo: historyFilter.value.dateTo || undefined,
    })
  }
}

async function nextPage() {
  if (transferStore.page * transferStore.pageSize < transferStore.total) {
    transferStore.page++
    await transferStore.fetchByClient(clientId.value, {
      status: historyFilter.value.status || undefined,
      dateFrom: historyFilter.value.dateFrom || undefined,
      dateTo: historyFilter.value.dateTo || undefined,
    })
  }
}

const totalPages = computed(() =>
  Math.ceil(transferStore.total / transferStore.pageSize) || 1
)

function statusBadgeClass(status: string) {
  switch (status) {
    case 'uspesno': return 'badge-success'
    case 'neuspesno': return 'badge-error'
    case 'u_obradi': return 'badge-warning'
    default: return 'badge-neutral'
  }
}

onMounted(async () => {
  if (clientId.value) {
    await accountStore.fetchAccounts(clientId.value)
    await transferStore.fetchByClient(clientId.value)
  }
})
</script>

<template>
  <div class="page-container">
    <h1 class="page-title">Transferi</h1>

    <!-- New Transfer Card -->
    <div class="card mb-6">
      <div class="card-header">
        <h2>Novi transfer</h2>
      </div>
      <div class="card-body">

        <!-- Step: Form -->
        <div v-if="step === 'form'">
          <div class="form-group">
            <label>Sa računa</label>
            <select v-model="form.fromAccountId" class="form-input">
              <option value="">-- Izaberite račun --</option>
              <option v-for="acc in accountStore.accounts" :key="acc.id" :value="String(acc.id)">
                {{ acc.naziv || acc.brojRacuna }} ({{ acc.currencyKod }}) — {{ acc.raspolozivoStanje.toLocaleString('sr-RS') }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Na račun</label>
            <select v-model="form.toAccountId" class="form-input">
              <option value="">-- Izaberite račun --</option>
              <option
                v-for="acc in accountStore.accounts"
                :key="acc.id"
                :value="String(acc.id)"
                :disabled="String(acc.id) === form.fromAccountId"
              >
                {{ acc.naziv || acc.brojRacuna }} ({{ acc.currencyKod }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Iznos</label>
            <input v-model="form.iznos" type="number" min="0.01" step="0.01" class="form-input" placeholder="0.00" />
          </div>

          <!-- Cross-currency preview -->
          <div v-if="isCrossCurrency" class="exchange-preview">
            <span v-if="loadingPreview" class="text-muted">Računam kurs...</span>
            <span v-else-if="exchangePreview">
              {{ Number(form.iznos).toLocaleString('sr-RS') }} {{ fromAccount?.currencyKod }}
              ≈ {{ exchangePreview.outputAmount.toLocaleString('sr-RS') }} {{ toAccount?.currencyKod }}
              (kurs: {{ exchangePreview.rate }})
            </span>
          </div>

          <div class="form-group">
            <label>Svrha</label>
            <input v-model="form.svrha" type="text" class="form-input" placeholder="Svrha transakcije" />
          </div>

          <div v-if="transferStore.error" class="error-message">{{ transferStore.error }}</div>

          <button
            class="btn btn-primary"
            :disabled="!form.fromAccountId || !form.toAccountId || !form.iznos || !form.svrha || form.fromAccountId === form.toAccountId"
            @click="goToConfirm"
          >
            Dalje
          </button>
        </div>

        <!-- Step: Confirm -->
        <div v-else-if="step === 'confirm'">
          <h3>Potvrda transfera</h3>
          <table class="detail-table">
            <tbody>
              <tr>
                <th>Sa računa</th>
                <td>{{ fromAccount?.naziv || fromAccount?.brojRacuna }} ({{ fromAccount?.currencyKod }})</td>
              </tr>
              <tr>
                <th>Na račun</th>
                <td>{{ toAccount?.naziv || toAccount?.brojRacuna }} ({{ toAccount?.currencyKod }})</td>
              </tr>
              <tr>
                <th>Iznos</th>
                <td>{{ Number(form.iznos).toLocaleString('sr-RS') }} {{ fromAccount?.currencyKod }}</td>
              </tr>
              <tr v-if="exchangePreview">
                <th>Konvertovani iznos</th>
                <td>{{ exchangePreview.outputAmount.toLocaleString('sr-RS') }} {{ toAccount?.currencyKod }}</td>
              </tr>
              <tr>
                <th>Svrha</th>
                <td>{{ form.svrha }}</td>
              </tr>
            </tbody>
          </table>

          <div class="action-row">
            <button class="btn btn-secondary" @click="step = 'form'">Nazad</button>
            <button class="btn btn-primary" :disabled="transferStore.loading" @click="handleSubmit">
              {{ transferStore.loading ? 'Šaljem...' : 'Potvrdi' }}
            </button>
          </div>
        </div>

        <!-- Step: Success -->
        <div v-else-if="step === 'success'" class="success-box">
          <div class="success-icon">✓</div>
          <p>Transfer je uspešno realizovan!</p>
          <button class="btn btn-primary" @click="startNew">Novi transfer</button>
        </div>

      </div>
    </div>

    <!-- Transfer History -->
    <div class="card">
      <div class="card-header">
        <h2>Istorija transfera</h2>
      </div>
      <div class="card-body">

        <!-- Filters -->
        <div class="filter-row">
          <select v-model="historyFilter.status" class="form-input filter-input" @change="applyHistoryFilter">
            <option value="">Svi statusi</option>
            <option value="uspesno">Uspešno</option>
            <option value="neuspesno">Neuspešno</option>
            <option value="u_obradi">U obradi</option>
          </select>
          <input v-model="historyFilter.dateFrom" type="date" class="form-input filter-input" @change="applyHistoryFilter" />
          <input v-model="historyFilter.dateTo" type="date" class="form-input filter-input" @change="applyHistoryFilter" />
        </div>

        <div v-if="transferStore.loading" class="loading-msg">Učitavam...</div>
        <div v-else-if="transferStore.transfers.length === 0" class="empty-msg">Nema transfera.</div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Sa računa</th>
              <th>Na račun</th>
              <th>Iznos</th>
              <th>Svrha</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in transferStore.transfers" :key="t.id">
              <td>{{ new Date(t.vremeTransakcije).toLocaleDateString('sr-RS') }}</td>
              <td>{{ t.racunPosiljaocaId }}</td>
              <td>{{ t.racunPrimaocaId }}</td>
              <td>{{ t.iznos.toLocaleString('sr-RS') }} {{ t.valutaIznosa }}</td>
              <td>{{ t.svrha }}</td>
              <td><span :class="['badge', statusBadgeClass(t.status)]">{{ t.status }}</span></td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div v-if="transferStore.total > transferStore.pageSize" class="pagination">
          <button class="btn btn-secondary" :disabled="transferStore.page <= 1" @click="prevPage">‹</button>
          <span>{{ transferStore.page }} / {{ totalPages }}</span>
          <button class="btn btn-secondary" :disabled="transferStore.page >= totalPages" @click="nextPage">›</button>
        </div>

      </div>
    </div>
  </div>
</template>
