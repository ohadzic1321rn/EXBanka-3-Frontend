<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'
import { CURRENCIES, type AccountProto } from '../api/account'

const router = useRouter()
const store = useAccountStore()

const selectedAccount = ref<AccountProto | null>(null)
const detailLoading = ref(false)

async function openDetail(account: AccountProto) {
  detailLoading.value = true
  try {
    selectedAccount.value = await store.getAccount(account.id)
  } catch {
    store.error = 'Failed to load account details.'
  } finally {
    detailLoading.value = false
  }
}

function applyFilters() {
  store.setFilters({
    clientName: store.filters.clientName,
    tip:        store.filters.tip,
    vrsta:      store.filters.vrsta,
    status:     store.filters.status,
    currencyId: store.filters.currencyId,
  })
  store.fetchAllAccounts()
}

function clearFilters() {
  store.clearFilters()
  store.fetchAllAccounts()
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'aktivan':   return 'badge badge-green'
    case 'blokiran':  return 'badge badge-red'
    case 'zatvoren':  return 'badge'
    default:          return 'badge'
  }
}

const totalPages = () => Math.ceil(store.total / store.pageSize)

onMounted(() => store.fetchAllAccounts())
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>Accounts</h1>
      <button class="btn-primary" @click="router.push('/accounts/new')">+ Create Account</button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input
        v-model="store.filters.clientName"
        placeholder="Filter by client name"
        @keyup.enter="applyFilters"
      />
      <select v-model="store.filters.tip" @change="applyFilters">
        <option value="">All types</option>
        <option value="tekuci">Tekući</option>
        <option value="devizni">Devizni</option>
      </select>
      <select v-model="store.filters.vrsta" @change="applyFilters">
        <option value="">All kinds</option>
        <option value="licni">Lični</option>
        <option value="poslovni">Poslovni</option>
      </select>
      <select v-model="store.filters.status" @change="applyFilters">
        <option value="">All statuses</option>
        <option value="aktivan">Aktivan</option>
        <option value="blokiran">Blokiran</option>
        <option value="zatvoren">Zatvoren</option>
      </select>
      <select v-model="store.filters.currencyId" @change="applyFilters">
        <option :value="undefined">All currencies</option>
        <option v-for="c in CURRENCIES" :key="c.id" :value="c.id">{{ c.kod }}</option>
      </select>
      <button class="btn-primary" @click="applyFilters">Search</button>
      <button class="btn-secondary" @click="clearFilters">Clear</button>
    </div>

    <p v-if="store.error" class="global-error" style="margin-bottom:12px">{{ store.error }}</p>

    <!-- Table -->
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr>
            <th>Account Number</th>
            <th>Client</th>
            <th>Currency</th>
            <th>Type</th>
            <th>Kind</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="store.loading">
            <td colspan="7" style="text-align:center;padding:24px;color:#6b7280">Loading...</td>
          </tr>
          <tr v-else-if="store.accounts.length === 0">
            <td colspan="7" style="text-align:center;padding:24px;color:#6b7280">No accounts found.</td>
          </tr>
          <tr
            v-for="account in store.accounts"
            :key="account.id"
            style="cursor:pointer"
            @click="openDetail(account)"
          >
            <td><code style="font-size:13px">{{ account.brojRacuna }}</code></td>
            <td>{{ account.clientId ? `#${account.clientId}` : '—' }}</td>
            <td>{{ account.currencyKod }}</td>
            <td style="text-transform:capitalize">{{ account.tip }}</td>
            <td style="text-transform:capitalize">{{ account.vrsta }}</td>
            <td>{{ Number(account.stanje).toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }}</td>
            <td>
              <span :class="statusBadgeClass(account.status)">
                {{ account.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="store.total > store.pageSize" class="pagination">
      <button class="btn-secondary btn-sm" :disabled="store.page <= 1" @click="store.page--; store.fetchAllAccounts()">←</button>
      <span>Page {{ store.page }} of {{ totalPages() }} ({{ store.total }} total)</span>
      <button class="btn-secondary btn-sm" :disabled="store.page >= totalPages()" @click="store.page++; store.fetchAllAccounts()">→</button>
    </div>
  </div>

  <!-- Account Detail Modal -->
  <div v-if="selectedAccount" class="modal-overlay" @click.self="selectedAccount = null">
    <div class="modal">
      <div class="modal-header">
        <h2>Account Details</h2>
        <button class="modal-close" @click="selectedAccount = null">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Account Number</div>
            <code>{{ selectedAccount.brojRacuna }}</code>
          </div>
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Status</div>
            <span :class="statusBadgeClass(selectedAccount.status)">{{ selectedAccount.status }}</span>
          </div>
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Currency</div>
            <div>{{ selectedAccount.currencyKod }}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Type / Kind</div>
            <div>{{ selectedAccount.tip }} / {{ selectedAccount.vrsta }}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Balance</div>
            <div>{{ Number(selectedAccount.stanje).toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Available</div>
            <div>{{ Number(selectedAccount.raspolozivoStanje).toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Daily Limit</div>
            <div>{{ Number(selectedAccount.dnevniLimit).toLocaleString('sr-RS') }}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Monthly Limit</div>
            <div>{{ Number(selectedAccount.mesecniLimit).toLocaleString('sr-RS') }}</div>
          </div>
          <div v-if="selectedAccount.naziv">
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Name</div>
            <div>{{ selectedAccount.naziv }}</div>
          </div>
        </div>
        <!-- No card admin — Sprint 2 guardrail -->
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" @click="selectedAccount = null">Close</button>
      </div>
    </div>
  </div>
</template>
