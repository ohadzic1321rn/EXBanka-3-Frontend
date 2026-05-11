<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import {
  clientFundApi,
  type FundSummary,
  type FundHolding,
  type FundPerformancePoint,
} from '../../api/fund'
import { clientAccountApi } from '../../api/clientAccount'
import { useClientAuthStore } from '../../stores/clientAuth'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const route = useRoute()
const router = useRouter()
const clientAuth = useClientAuthStore()
const fundId = computed(() => Number(route.params.id))

const fund = ref<FundSummary | null>(null)
const holdings = ref<FundHolding[]>([])
const performance = ref<FundPerformancePoint[]>([])
const granularity = ref<'monthly' | 'quarterly' | 'yearly'>('monthly')

const loading = ref(false)
const errorMsg = ref('')

const accounts = ref<Array<{ id: number; label: string; balance: number; currency: string }>>([])
const investOpen = ref(false)
const withdrawOpen = ref(false)
const investAmount = ref(0)
const investAccountId = ref<number | null>(null)
const withdrawAmount = ref(0)
const withdrawAll = ref(false)
const withdrawAccountId = ref<number | null>(null)
const dialogBusy = ref(false)
const dialogError = ref('')

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [fundRes, holdingsRes, perfRes] = await Promise.all([
      clientFundApi.get(fundId.value),
      clientFundApi.holdings(fundId.value),
      clientFundApi.performance(fundId.value, granularity.value),
    ])
    fund.value = fundRes.data?.fund ?? null
    holdings.value = holdingsRes.data?.holdings ?? []
    performance.value = perfRes.data?.performance ?? []
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Greska pri ucitavanju fonda.'
  } finally {
    loading.value = false
  }
}

async function loadAccounts() {
  const clientId = clientAuth.client?.id
  if (!clientId) return
  try {
    const res = await clientAccountApi.listByClient(clientId)
    const items: any[] = res.data?.accounts ?? res.data ?? []
    accounts.value = items
      .filter((a: any) => a.status === 'aktivan' && (a.currencyKod === 'RSD' || a.currency?.kod === 'RSD'))
      .map((a: any) => ({
        id: Number(a.id),
        label: `${a.naziv || a.brojRacuna}`,
        balance: Number(a.raspolozivoStanje),
        currency: a.currencyKod || a.currency?.kod || 'RSD',
      }))
    if (accounts.value.length > 0) {
      if (investAccountId.value === null) investAccountId.value = accounts.value[0]!.id
      if (withdrawAccountId.value === null) withdrawAccountId.value = accounts.value[0]!.id
    }
  } catch {
    // ignore
  }
}

watch(granularity, async () => {
  try {
    const res = await clientFundApi.performance(fundId.value, granularity.value)
    performance.value = res.data?.performance ?? []
  } catch {
    // ignore
  }
})

async function submitInvest() {
  if (!investAccountId.value || investAmount.value <= 0) return
  dialogBusy.value = true
  dialogError.value = ''
  try {
    await clientFundApi.invest(fundId.value, {
      sourceAccountId: investAccountId.value,
      amount: investAmount.value,
    })
    investOpen.value = false
    investAmount.value = 0
    await load()
  } catch (err: any) {
    dialogError.value = err?.response?.data?.message ?? 'Greska pri uplati.'
  } finally {
    dialogBusy.value = false
  }
}

async function submitWithdraw() {
  if (!withdrawAccountId.value) return
  dialogBusy.value = true
  dialogError.value = ''
  try {
    const res = await clientFundApi.withdraw(fundId.value, {
      destinationAccountId: withdrawAccountId.value,
      amount: withdrawAll.value ? undefined : withdrawAmount.value,
      withdrawAll: withdrawAll.value,
    })
    withdrawOpen.value = false
    withdrawAmount.value = 0
    withdrawAll.value = false
    const data = res.data
    if (data?.liquidated) {
      alert(`Povucenа suma ${data.grossWithdrawn.toFixed(2)} RSD (od cega ${data.commission.toFixed(2)} RSD provizija). Auto-likvidirano je ${data.liquidatedItems.length} pozicija u fondu.`)
    }
    await load()
  } catch (err: any) {
    dialogError.value = err?.response?.data?.message ?? 'Greska pri povlacenju.'
  } finally {
    dialogBusy.value = false
  }
}

const chartData = computed<ChartData<'line'>>(() => ({
  labels: performance.value.map((p) => p.date),
  datasets: [
    {
      label: 'Vrednost fonda (RSD)',
      data: performance.value.map((p) => p.fundValue),
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37,99,235,0.08)',
      borderWidth: 2,
      pointRadius: 3,
      fill: true,
      tension: 0.3,
    },
  ],
}))
const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
  scales: {
    x: { grid: { display: false } },
    y: { ticks: { callback: (v: any) => `${Number(v).toLocaleString()}` } },
  },
}

onMounted(async () => {
  await load()
  await loadAccounts()
})
</script>

<template>
  <div class="fund-detail">
    <button class="back-btn" @click="router.push('/client/funds')">&larr; Nazad na listu</button>

    <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>
    <div v-if="loading" class="hint">Ucitavam...</div>

    <template v-else-if="fund">
      <header class="card">
        <h1>{{ fund.naziv }}</h1>
        <p class="muted">{{ fund.opis }}</p>
        <div class="kpi-grid">
          <div class="kpi"><span>Vrednost fonda</span><strong>{{ fund.fundValueRSD.toFixed(2) }} RSD</strong></div>
          <div class="kpi"><span>Likvidnost</span><strong>{{ fund.liquidCashRSD.toFixed(2) }} RSD</strong></div>
          <div class="kpi"><span>Profit</span><strong :class="fund.profitRSD >= 0 ? 'positive' : 'negative'">{{ fund.profitRSD.toFixed(2) }} RSD</strong></div>
          <div class="kpi"><span>Minimalni ulog</span><strong>{{ fund.minimalniUlog.toFixed(2) }} RSD</strong></div>
          <div class="kpi"><span>Ucesnika</span><strong>{{ fund.participantsCount }}</strong></div>
        </div>
        <div class="actions">
          <button class="btn-primary" @click="investOpen = true">Uplati u fond</button>
          <button class="btn-secondary" @click="withdrawOpen = true">Povuci sredstva</button>
        </div>
      </header>

      <section class="card">
        <div class="section-header">
          <h2>Performanse fonda</h2>
          <select v-model="granularity">
            <option value="monthly">Mesecno</option>
            <option value="quarterly">Kvartalno</option>
            <option value="yearly">Godisnje</option>
          </select>
        </div>
        <div class="chart-wrapper">
          <Line v-if="performance.length > 0" :data="chartData" :options="chartOptions" />
          <p v-else class="hint">Nema istorijskih podataka.</p>
        </div>
      </section>

      <section class="card">
        <h2>Hartije u fondu</h2>
        <table v-if="holdings.length > 0" class="data-table">
          <thead>
            <tr>
              <th>Ticker</th><th>Naziv</th>
              <th class="num">Cena</th><th class="num">Promena</th><th class="num">Volume</th>
              <th class="num">Kolicina</th><th class="num">Pros. cena kupovine</th>
              <th>Datum sticanja</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in holdings" :key="h.id">
              <td><strong>{{ h.ticker }}</strong></td>
              <td>{{ h.name }}</td>
              <td class="num">{{ h.price.toFixed(2) }}</td>
              <td class="num">{{ h.change.toFixed(2) }}</td>
              <td class="num">{{ h.volume.toLocaleString() }}</td>
              <td class="num">{{ h.quantity.toFixed(2) }}</td>
              <td class="num">{{ h.avgBuyPrice.toFixed(2) }}</td>
              <td>{{ h.acquisitionDate }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="hint">Fond jos uvek nema hartija.</p>
      </section>
    </template>

    <!-- Invest modal -->
    <div v-if="investOpen" class="modal-overlay" @click.self="investOpen = false">
      <div class="modal-box">
        <h2>Uplata u fond</h2>
        <div v-if="dialogError" class="error-box">{{ dialogError }}</div>
        <div class="field">
          <label>Izvorni racun (RSD)</label>
          <select v-model.number="investAccountId">
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.label }} ({{ a.balance.toFixed(2) }} RSD)</option>
          </select>
        </div>
        <div class="field">
          <label>Iznos (min. {{ fund?.minimalniUlog.toFixed(2) }} RSD)</label>
          <input type="number" v-model.number="investAmount" min="0" step="0.01" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" :disabled="dialogBusy" @click="investOpen = false">Otkazi</button>
          <button class="btn-primary" :disabled="dialogBusy" @click="submitInvest">{{ dialogBusy ? 'Slanje...' : 'Uplati' }}</button>
        </div>
      </div>
    </div>

    <!-- Withdraw modal -->
    <div v-if="withdrawOpen" class="modal-overlay" @click.self="withdrawOpen = false">
      <div class="modal-box">
        <h2>Povlacenje sredstava</h2>
        <div v-if="dialogError" class="error-box">{{ dialogError }}</div>
        <div class="field">
          <label>Destinacioni racun</label>
          <select v-model.number="withdrawAccountId">
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.label }}</option>
          </select>
        </div>
        <div class="field">
          <label class="check"><input type="checkbox" v-model="withdrawAll" /> Povuci celu poziciju</label>
        </div>
        <div v-if="!withdrawAll" class="field">
          <label>Iznos (RSD)</label>
          <input type="number" v-model.number="withdrawAmount" min="0" step="0.01" />
        </div>
        <p class="hint">Provizija {{ ((fund?.withdrawalCommRate ?? 0) * 100).toFixed(2) }} % bice odbijena pri isplati.</p>
        <div class="modal-actions">
          <button class="btn-secondary" :disabled="dialogBusy" @click="withdrawOpen = false">Otkazi</button>
          <button class="btn-primary" :disabled="dialogBusy" @click="submitWithdraw">{{ dialogBusy ? 'Slanje...' : 'Povuci' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fund-detail { padding: 32px; max-width: 1200px; margin: 0 auto; }
.back-btn { background: none; border: none; color: #2563eb; font-size: 14px; cursor: pointer; margin-bottom: 16px; }
.card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 2px 12px rgba(15,23,42,0.05); margin-bottom: 24px; }
.card h1 { margin: 0 0 6px; color: #0f172a; font-size: 26px; }
.card h2 { margin: 0 0 16px; color: #0f172a; font-size: 18px; }
.muted { color: #64748b; margin: 0 0 20px; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 20px; }
.kpi { background: #f8fafc; padding: 14px; border-radius: 12px; }
.kpi span { display: block; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
.kpi strong { font-size: 20px; color: #0f172a; }
.actions { display: flex; gap: 10px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header select { padding: 7px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; }
.chart-wrapper { position: relative; height: 320px; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; text-align: left; font-size: 14px; }
.data-table th { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.positive { color: #16a34a; }
.negative { color: #dc2626; }
.btn-primary { padding: 9px 18px; border: none; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
.btn-secondary { padding: 9px 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #374151; font-weight: 600; cursor: pointer; }
.error-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 10px; padding: 10px 14px; color: #b91c1c; margin-bottom: 14px; }
.hint { color: #64748b; text-align: center; padding: 20px 0; }
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.modal-box { background: #fff; border-radius: 18px; padding: 24px; width: 100%; max-width: 480px; }
.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.field label { font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
.field label.check { text-transform: none; font-weight: 500; color: #0f172a; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.field input, .field select { padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
</style>
