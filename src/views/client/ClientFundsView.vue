<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { clientFundApi, type FundSummary, type FundPositionView } from '../../api/fund'

const router = useRouter()
const activeTab = ref<'all' | 'mine'>('all')
const funds = ref<FundSummary[]>([])
const myPositions = ref<FundPositionView[]>([])
const loading = ref(false)
const errorMsg = ref('')

const sortKey = ref<'naziv' | 'value' | 'profit' | 'minimalni'>('naziv')
const search = ref('')

const filtered = computed(() => {
  let rows = [...funds.value]
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    rows = rows.filter((f) => f.naziv.toLowerCase().includes(q) || f.opis.toLowerCase().includes(q))
  }
  rows.sort((a, b) => {
    switch (sortKey.value) {
      case 'value': return b.fundValueRSD - a.fundValueRSD
      case 'profit': return b.profitRSD - a.profitRSD
      case 'minimalni': return a.minimalniUlog - b.minimalniUlog
      default: return a.naziv.localeCompare(b.naziv)
    }
  })
  return rows
})

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [allRes, mineRes] = await Promise.all([clientFundApi.list(), clientFundApi.mine()])
    funds.value = allRes.data?.funds ?? []
    myPositions.value = mineRes.data?.positions ?? []
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Greska pri ucitavanju fondova.'
  } finally {
    loading.value = false
  }
}

function openFund(id: number) {
  router.push(`/client/funds/${id}`)
}

onMounted(load)
</script>

<template>
  <div class="funds-view">
    <header class="view-header">
      <h1>Investicioni fondovi</h1>
      <p>Pregled svih dostupnih fondova i vasih ulaganja.</p>
    </header>

    <div class="tabs">
      <button :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">Svi fondovi</button>
      <button :class="{ active: activeTab === 'mine' }" @click="activeTab = 'mine'">Moji fondovi ({{ myPositions.length }})</button>
    </div>

    <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>

    <!-- All funds tab -->
    <section v-if="activeTab === 'all'" class="card">
      <div class="filters">
        <input type="text" v-model="search" placeholder="Pretraga po nazivu ili opisu..." />
        <select v-model="sortKey">
          <option value="naziv">Sortiraj: naziv</option>
          <option value="value">Sortiraj: vrednost</option>
          <option value="profit">Sortiraj: profit</option>
          <option value="minimalni">Sortiraj: minimalni ulog</option>
        </select>
      </div>
      <div v-if="loading" class="hint">Ucitavam...</div>
      <table v-else-if="filtered.length > 0" class="data-table">
        <thead>
          <tr>
            <th>Naziv</th>
            <th>Opis</th>
            <th class="num">Vrednost (RSD)</th>
            <th class="num">Profit (RSD)</th>
            <th class="num">Min. ulog</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in filtered" :key="f.id" class="clickable" @click="openFund(f.id)">
            <td><strong>{{ f.naziv }}</strong></td>
            <td class="muted">{{ f.opis }}</td>
            <td class="num">{{ f.fundValueRSD.toFixed(2) }}</td>
            <td class="num" :class="f.profitRSD >= 0 ? 'positive' : 'negative'">{{ f.profitRSD.toFixed(2) }}</td>
            <td class="num">{{ f.minimalniUlog.toFixed(2) }}</td>
            <td><button class="btn-primary" @click.stop="openFund(f.id)">Investiraj</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="hint">Nema dostupnih fondova.</p>
    </section>

    <!-- My positions tab -->
    <section v-else class="card">
      <div v-if="loading" class="hint">Ucitavam...</div>
      <table v-else-if="myPositions.length > 0" class="data-table">
        <thead>
          <tr>
            <th>Fond</th>
            <th class="num">Vrednost fonda (RSD)</th>
            <th class="num">Ulozeno (RSD)</th>
            <th class="num">Udeo (%)</th>
            <th class="num">Trenutna vrednost</th>
            <th class="num">Profit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in myPositions" :key="p.fundId" class="clickable" @click="openFund(p.fundId)">
            <td><strong>{{ p.naziv }}</strong></td>
            <td class="num">{{ p.fundValueRSD.toFixed(2) }}</td>
            <td class="num">{{ p.ukupanUlozeniRSD.toFixed(2) }}</td>
            <td class="num">{{ p.udeoProcenat.toFixed(2) }} %</td>
            <td class="num">{{ p.trenutnaVrednost.toFixed(2) }}</td>
            <td class="num" :class="p.profitRSD >= 0 ? 'positive' : 'negative'">{{ p.profitRSD.toFixed(2) }}</td>
            <td><button class="btn-primary" @click.stop="openFund(p.fundId)">Otvori</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="hint">Jos uvek niste ulozili ni u jedan fond.</p>
    </section>
  </div>
</template>

<style scoped>
.funds-view { padding: 32px; max-width: 1200px; margin: 0 auto; }
.view-header h1 { margin: 0 0 4px; font-size: 28px; color: #0f172a; }
.view-header p { margin: 0 0 24px; color: #64748b; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs button { padding: 10px 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer; font-weight: 600; color: #475569; }
.tabs button.active { background: #0f172a; color: #fff; border-color: #0f172a; }
.card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 2px 12px rgba(15,23,42,0.05); }
.filters { display: flex; gap: 12px; margin-bottom: 16px; }
.filters input, .filters select { padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
.filters input { flex: 1; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; text-align: left; font-size: 14px; }
.data-table th { color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.data-table tr.clickable { cursor: pointer; }
.data-table tr.clickable:hover td { background: #f8fafc; }
.muted { color: #64748b; }
.positive { color: #16a34a; }
.negative { color: #dc2626; }
.btn-primary { padding: 6px 14px; border-radius: 8px; border: none; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; font-size: 13px; }
.btn-primary:hover { background: #1d4ed8; }
.error-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 10px; padding: 10px 14px; color: #b91c1c; margin-bottom: 16px; }
.hint { color: #64748b; padding: 20px 0; text-align: center; }
</style>
