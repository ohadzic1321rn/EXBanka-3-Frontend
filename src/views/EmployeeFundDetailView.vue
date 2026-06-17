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
  fundApi,
  type FundSummary,
  type FundHolding,
  type FundPerformancePoint,
  type FundStatistics,
  type FundDividend,
  type FundDividendPayout,
  type FundDividendPolicy,
} from '../api/fund'
import { accountApi } from '../api/account'
import { useAuthStore } from '../stores/auth'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const fundId = computed(() => Number(route.params.id))

const fund = ref<FundSummary | null>(null)
const holdings = ref<FundHolding[]>([])
const performance = ref<FundPerformancePoint[]>([])
const granularity = ref<'monthly' | 'quarterly' | 'yearly'>('monthly')
const statistics = ref<FundStatistics | null>(null)
const dividends = ref<FundDividend[]>([])
const dividendPayouts = ref<FundDividendPayout[]>([])
const policyBusy = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const isSupervisor = computed(() => auth.hasPermission('employeeSupervisor'))
const isManager = computed(() => isSupervisor.value && fund.value?.managerId === auth.employee?.id)
// The dividend policy is normally the managing supervisor's to set, but an admin
// may override it on any fund (matches the backend admin override).
const canManagePolicy = computed(() => isManager.value || auth.isAdmin())

// Bank-invest dialog (supervisor on bank's behalf)
const investOpen = ref(false)
const investAmount = ref(0)
const bankAccounts = ref<Array<{ id: number; label: string }>>([])
const investAccountId = ref<number | null>(null)
const dialogBusy = ref(false)
const dialogError = ref('')

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [fundRes, holdingsRes, perfRes, statsRes, divRes] = await Promise.all([
      fundApi.get(fundId.value),
      fundApi.holdings(fundId.value),
      fundApi.performance(fundId.value, granularity.value),
      fundApi.statistics(fundId.value),
      fundApi.dividends(fundId.value),
    ])
    fund.value = fundRes.data?.fund ?? null
    holdings.value = holdingsRes.data?.holdings ?? []
    performance.value = perfRes.data?.performance ?? []
    statistics.value = statsRes.data?.statistics ?? null
    dividends.value = divRes.data?.dividends ?? []
    dividendPayouts.value = divRes.data?.payouts ?? []
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Greska pri ucitavanju fonda.'
  } finally {
    loading.value = false
  }
}

async function loadBankAccounts() {
  try {
    const res = await accountApi.listAll({ status: 'aktivan', pageSize: 200 })
    const items: any[] = res.data?.accounts ?? res.data?.content ?? res.data ?? []
    // Bank operational accounts: no client owner, firma is set and is NOT the
    // state firma (Republika Srbija). Fund-owned accounts have no firma so they
    // are excluded automatically.
    bankAccounts.value = items
      .filter((a: any) =>
        (!a.clientId || a.clientId === '0' || a.clientId === 0) &&
        !!a.firmaId && a.firmaId !== '0' && a.firmaId !== 0 &&
        a.firma?.isState === false &&
        a.podvrsta !== 'fondacija' &&
        (a.currencyKod === 'RSD' || a.currency?.kod === 'RSD'),
      )
      .map((a: any) => ({ id: Number(a.id), label: `${a.naziv || a.brojRacuna}` }))
    if (bankAccounts.value.length > 0 && investAccountId.value === null) {
      investAccountId.value = bankAccounts.value[0]!.id
    }
  } catch {
    // ignore
  }
}

watch(granularity, async () => {
  try {
    const res = await fundApi.performance(fundId.value, granularity.value)
    performance.value = res.data?.performance ?? []
  } catch {
    // ignore
  }
})

async function submitInvestForBank() {
  if (!investAccountId.value || investAmount.value <= 0) return
  dialogBusy.value = true
  dialogError.value = ''
  try {
    await fundApi.invest(fundId.value, {
      sourceAccountId: investAccountId.value,
      amount: investAmount.value,
      asBank: true,
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

async function changeDividendPolicy(policy: FundDividendPolicy) {
  if (!fund.value || fund.value.dividendPolicy === policy) return
  policyBusy.value = true
  try {
    await fundApi.setDividendPolicy(fundId.value, policy)
    fund.value.dividendPolicy = policy
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Greska pri promeni politike dividendi.'
  } finally {
    policyBusy.value = false
  }
}

// Manual dividend run (manager only). The distribution is idempotent per
// (fund, asset, quarter), so re-running in the same quarter reports the
// already-paid holdings as "skipped" rather than paying twice.
const dividendBusy = ref(false)
const dividendMsg = ref('')
async function runDividends() {
  dividendBusy.value = true
  dividendMsg.value = ''
  try {
    const res = await fundApi.runDividends()
    const r = res.data
    dividendMsg.value = `Period ${r.period}: ${r.processed} isplaćeno, ${r.skipped} preskočeno, ${r.failed} neuspešno (od ${r.eligible} podobnih).`
    await load()
  } catch (err: any) {
    dividendMsg.value = err?.response?.data?.message ?? 'Greška pri pokretanju dividendi.'
  } finally {
    dividendBusy.value = false
  }
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(2)} %`
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
  scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v: any) => `${Number(v).toLocaleString()}` } } },
}

onMounted(async () => {
  await load()
  await loadBankAccounts()
})
</script>

<template>
  <div class="fund-detail">
    <button class="back-btn" @click="router.push('/funds')">&larr; Nazad na fondove</button>

    <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>
    <div v-if="loading" class="hint">Ucitavam...</div>

    <template v-else-if="fund">
      <header class="card">
        <h1>{{ fund.naziv }}</h1>
        <p class="muted">{{ fund.opis }}</p>
        <div class="kpi-grid">
          <div class="kpi"><span>Vrednost</span><strong>{{ fund.fundValueRSD.toFixed(2) }} RSD</strong></div>
          <div class="kpi"><span>Likvidnost</span><strong>{{ fund.liquidCashRSD.toFixed(2) }} RSD</strong></div>
          <div class="kpi"><span>Vrednost hartija</span><strong>{{ fund.holdingsValueRSD.toFixed(2) }} RSD</strong></div>
          <div class="kpi"><span>Profit</span><strong :class="fund.profitRSD >= 0 ? 'positive' : 'negative'">{{ fund.profitRSD.toFixed(2) }} RSD</strong></div>
          <div class="kpi"><span>Min. ulog</span><strong>{{ fund.minimalniUlog.toFixed(2) }} RSD</strong></div>
          <div class="kpi"><span>Ucesnika</span><strong>{{ fund.participantsCount }}</strong></div>
          <div class="kpi"><span>Menadzer (ID)</span><strong>{{ fund.managerId }}</strong></div>
          <div class="kpi"><span>Racun fonda (ID)</span><strong>{{ fund.accountId }}</strong></div>
        </div>
        <div v-if="isSupervisor" class="actions">
          <button class="btn-primary" @click="investOpen = true">Uplati za banku</button>
          <button v-if="canManagePolicy" class="btn-secondary" @click="router.push('/securities')">Kupi hartiju za fond</button>
        </div>
        <div class="policy-row">
          <span class="policy-label">Politika dividendi:</span>
          <template v-if="canManagePolicy">
            <button
              class="policy-btn"
              :class="{ active: fund.dividendPolicy === 'reinvest' }"
              :disabled="policyBusy"
              @click="changeDividendPolicy('reinvest')"
            >Reinvestiranje</button>
            <button
              class="policy-btn"
              :class="{ active: fund.dividendPolicy === 'payout' }"
              :disabled="policyBusy"
              @click="changeDividendPolicy('payout')"
            >Isplata klijentima</button>
          </template>
          <strong v-else>{{ fund.dividendPolicy === 'payout' ? 'Isplata klijentima' : 'Reinvestiranje' }}</strong>
        </div>
      </header>

      <section class="card">
        <h2>Statistika fonda</h2>
        <div v-if="statistics?.available" class="kpi-grid">
          <div class="kpi"><span>Godišnji prinos</span><strong :class="statistics.annualizedReturn >= 0 ? 'positive' : 'negative'">{{ fmtPct(statistics.annualizedReturn) }}</strong></div>
          <div class="kpi"><span>Prinos/rizik</span><strong>{{ statistics.rewardToVariability.toFixed(2) }}</strong></div>
          <div class="kpi"><span>Max drawdown</span><strong class="negative">{{ fmtPct(statistics.maxDrawdown) }}</strong></div>
          <div class="kpi"><span>Volatilnost</span><strong>{{ fmtPct(statistics.volatility) }}</strong></div>
          <div class="kpi"><span>Meseci podataka</span><strong>{{ statistics.monthsOfData }}</strong></div>
        </div>
        <p v-else class="hint">Nedovoljno istorijskih podataka za prikaz metrika.</p>
      </section>

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
              <th class="num">Cena</th><th class="num">Volume</th>
              <th class="num">Kolicina</th><th class="num">Pros. cena kupovine</th>
              <th>Datum sticanja</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in holdings" :key="h.id">
              <td><strong>{{ h.ticker }}</strong></td>
              <td>{{ h.name }}</td>
              <td class="num">{{ h.price.toFixed(2) }}</td>
              <td class="num">{{ h.volume.toLocaleString() }}</td>
              <td class="num">{{ h.quantity.toFixed(2) }}</td>
              <td class="num">{{ h.avgBuyPrice.toFixed(2) }}</td>
              <td>{{ h.acquisitionDate }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="hint">Fond jos uvek nema hartija.</p>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Dividende fonda</h2>
          <button v-if="isSupervisor" class="btn-secondary" :disabled="dividendBusy" @click="runDividends">
            {{ dividendBusy ? 'Pokrećem…' : 'Pokreni dividende' }}
          </button>
        </div>
        <p v-if="dividendMsg" class="hint">{{ dividendMsg }}</p>
        <table v-if="dividends.length > 0" class="data-table">
          <thead>
            <tr>
              <th>Datum</th><th>Period</th><th>Hartija</th>
              <th class="num">Bruto (RSD)</th><th>Politika</th>
              <th class="num">Reinvestirano</th><th class="num">Isplaćeno (RSD)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in dividends" :key="d.id">
              <td>{{ new Date(d.paidAt).toLocaleDateString('sr-RS') }}</td>
              <td>{{ d.period }}</td>
              <td><strong>{{ d.ticker }}</strong></td>
              <td class="num">{{ d.grossRSD.toFixed(2) }}</td>
              <td>{{ d.policy === 'payout' ? 'Isplata' : 'Reinvestiranje' }}</td>
              <td class="num">{{ d.reinvestedShares > 0 ? `${d.reinvestedShares} kom (${d.reinvestedRSD.toFixed(2)})` : '—' }}</td>
              <td class="num">{{ d.distributedRSD > 0 ? d.distributedRSD.toFixed(2) : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="hint">Fond još uvek nije primio dividende.</p>
      </section>

      <section class="card">
        <h2>Isplate dividendi po učesniku</h2>
        <p class="hint">Detaljan prikaz kome je i koliko isplaćeno (politika „Isplata“).</p>
        <table v-if="dividendPayouts.length > 0" class="data-table">
          <thead>
            <tr>
              <th>Datum</th><th>Period</th><th>Hartija</th>
              <th>Učesnik</th><th>Račun</th><th class="num">Iznos (RSD)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in dividendPayouts" :key="p.id">
              <td>{{ new Date(p.paidAt).toLocaleDateString('sr-RS') }}</td>
              <td>{{ p.period }}</td>
              <td><strong>{{ p.ticker }}</strong></td>
              <td>{{ p.clientType === 'bank' ? 'Banka' : `Klijent #${p.clientId}` }}</td>
              <td>#{{ p.accountId }}</td>
              <td class="num">{{ p.amountRSD.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="hint">Još uvek nema isplata po učesniku (reinvestiranje ne proizvodi isplate).</p>
      </section>
    </template>

    <!-- Invest-for-bank modal -->
    <div v-if="investOpen" class="modal-overlay" @click.self="investOpen = false">
      <div class="modal-box">
        <h2>Uplata za banku</h2>
        <div v-if="dialogError" class="error-box">{{ dialogError }}</div>
        <div class="field">
          <label>Bankin racun (RSD)</label>
          <select v-model.number="investAccountId">
            <option v-for="a in bankAccounts" :key="a.id" :value="a.id">{{ a.label }}</option>
          </select>
        </div>
        <div class="field">
          <label>Iznos (min. {{ fund?.minimalniUlog.toFixed(2) }} RSD)</label>
          <input type="number" v-model.number="investAmount" min="0" step="0.01" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" :disabled="dialogBusy" @click="investOpen = false">Otkazi</button>
          <button class="btn-primary" :disabled="dialogBusy" @click="submitInvestForBank">{{ dialogBusy ? 'Slanje...' : 'Uplati' }}</button>
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
.kpi strong { font-size: 18px; color: #0f172a; }
.actions { display: flex; gap: 10px; }
.policy-row { display: flex; align-items: center; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
.policy-label { color: #64748b; font-size: 13px; font-weight: 600; }
.policy-btn { padding: 7px 14px; border: 1px solid #cbd5e1; border-radius: 999px; background: #fff; color: #475569; font-weight: 600; font-size: 13px; cursor: pointer; }
.policy-btn.active { background: #0f172a; color: #fff; border-color: #0f172a; }
.policy-btn:disabled { opacity: 0.6; cursor: not-allowed; }
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
.btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-head h2 { margin: 0; }
.error-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 10px; padding: 10px 14px; color: #b91c1c; margin-bottom: 14px; }
.hint { color: #64748b; text-align: center; padding: 20px 0; }
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.modal-box { background: #fff; border-radius: 18px; padding: 24px; width: 100%; max-width: 480px; }
.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.field label { font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
.field input, .field select { padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
</style>
