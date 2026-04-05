<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { employeeOrderApi } from '../api/order'
import type { Order, OrderStatus } from '../api/order'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type TabFilter = 'all' | OrderStatus

const TAB_LABELS: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'Sve' },
  { key: 'pending', label: 'Na čekanju' },
  { key: 'approved', label: 'Odobreni' },
  { key: 'declined', label: 'Odbijeni' },
  { key: 'done', label: 'Završeni' },
  { key: 'cancelled', label: 'Otkazani' },
]

const orders = ref<Order[]>([])
const loading = ref(false)
const error = ref('')
const activeTab = ref<TabFilter>('all')

const actionLoading = ref<Record<number, boolean>>({})
const actionError = ref<Record<number, string>>({})

const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function formatPrice(v: number) { return fmt.format(v) }

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const filtered = computed(() => {
  if (activeTab.value === 'all') return orders.value
  return orders.value.filter((o) => o.status === activeTab.value)
})

const counts = computed(() => {
  const c: Record<string, number> = { all: orders.value.length }
  for (const o of orders.value) {
    c[o.status] = (c[o.status] ?? 0) + 1
  }
  return c
})

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await employeeOrderApi.listOrders()
    orders.value = res.data.orders ?? []
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Greška pri učitavanju naloga.'
  } finally {
    loading.value = false
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function approve(id: number) {
  actionLoading.value[id] = true
  delete actionError.value[id]
  try {
    await employeeOrderApi.approveOrder(id)
    await load()
  } catch (e: any) {
    actionError.value[id] = e?.response?.data?.message ?? 'Greška.'
  } finally {
    actionLoading.value[id] = false
  }
}

async function decline(id: number) {
  actionLoading.value[id] = true
  delete actionError.value[id]
  try {
    await employeeOrderApi.declineOrder(id)
    await load()
  } catch (e: any) {
    actionError.value[id] = e?.response?.data?.message ?? 'Greška.'
  } finally {
    actionLoading.value[id] = false
  }
}

async function cancel(id: number) {
  actionLoading.value[id] = true
  delete actionError.value[id]
  try {
    await employeeOrderApi.cancelOrder(id)
    await load()
  } catch (e: any) {
    actionError.value[id] = e?.response?.data?.message ?? 'Greška.'
  } finally {
    actionLoading.value[id] = false
  }
}

// ---------------------------------------------------------------------------

onMounted(load)
</script>

<template>
  <div class="review-page">
    <div class="page-header">
      <div>
        <h1>Pregled naloga</h1>
        <p>Odobrite, odbijte ili otkažite naloge agenata.</p>
      </div>
      <button class="refresh-btn" :disabled="loading" @click="load">
        {{ loading ? '...' : 'Osvezi' }}
      </button>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>

    <!-- Filter tabs -->
    <div class="tab-bar">
      <button
        v-for="tab in TAB_LABELS"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="counts[tab.key]" class="tab-count">{{ counts[tab.key] }}</span>
      </button>
    </div>

    <div v-if="loading" class="empty-state">Učitavam naloge...</div>
    <div v-else-if="filtered.length === 0" class="empty-state">
      Nema naloga za odabrani filter.
    </div>
    <div v-else class="table-wrap">
      <table class="orders-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Agent</th>
            <th>Hartija</th>
            <th>Tip naloga</th>
            <th>Smer</th>
            <th>Qty</th>
            <th>Vel. ugovora</th>
            <th>Cena/jed.</th>
            <th>Preostalo</th>
            <th>Status</th>
            <th>Akcije</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filtered" :key="order.id">
            <td class="id-cell">{{ order.id }}</td>
            <td>
              <div class="agent-cell">
                <span class="user-type-pill" :class="order.userType">{{ order.userType }}</span>
                {{ order.userId }}
              </div>
            </td>
            <td>
              <div class="ticker">{{ order.assetTicker }}</div>
              <div class="sub">{{ order.assetName }}</div>
            </td>
            <td>
              <span class="order-type-pill">{{ order.orderType.replace('_', '-') }}</span>
            </td>
            <td>
              <span :class="['direction-pill', order.direction]">
                {{ order.direction === 'buy' ? 'KUPI' : 'PRODAJ' }}
              </span>
            </td>
            <td>{{ order.quantity.toLocaleString('en-US') }}</td>
            <td>{{ order.contractSize.toLocaleString('en-US') }}</td>
            <td>{{ formatPrice(order.pricePerUnit) }}</td>
            <td :class="{ 'remaining-zero': order.remainingPortions === 0 }">
              {{ order.remainingPortions }}
            </td>
            <td>
              <span :class="['status-pill', order.status]">{{ order.status }}</span>
            </td>
            <td class="actions-cell">
              <div v-if="actionError[order.id]" class="inline-error">{{ actionError[order.id] }}</div>
              <div class="btn-group">
                <!-- Pending: approve + decline -->
                <template v-if="order.status === 'pending'">
                  <button
                    class="action-btn approve"
                    :disabled="actionLoading[order.id]"
                    @click="approve(order.id)"
                  >Odobri</button>
                  <button
                    class="action-btn decline"
                    :disabled="actionLoading[order.id]"
                    @click="decline(order.id)"
                  >Odbij</button>
                </template>
                <!-- Approved / partially filled: cancel -->
                <button
                  v-if="(order.status === 'approved' || order.status === 'pending') && !order.isDone"
                  class="action-btn cancel"
                  :disabled="actionLoading[order.id]"
                  @click="cancel(order.id)"
                >Otkaži</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.review-page {
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 30px;
  color: #0f172a;
}

.page-header p {
  margin: 6px 0 0;
  color: #64748b;
}

.refresh-btn {
  padding: 9px 18px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  background: #fff;
  color: #0f172a;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
.refresh-btn:hover:not(:disabled) { background: #f1f5f9; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.error-box {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  padding: 12px 16px;
  color: #b91c1c;
  margin-bottom: 18px;
}

/* --- Tabs --- */
.tab-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn:hover { background: #e2e8f0; }
.tab-btn.active {
  background: #0f172a;
  border-color: #0f172a;
  color: #fff;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(255,255,255,0.2);
  font-size: 11px;
  font-weight: 700;
}
.tab-btn:not(.active) .tab-count {
  background: #e2e8f0;
  color: #0f172a;
}

/* --- Table --- */
.table-wrap { overflow-x: auto; }

.orders-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
}

.orders-table th,
.orders-table td {
  padding: 13px 12px;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
  vertical-align: middle;
}

.orders-table th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  background: #f8fafc;
  font-weight: 700;
}

.orders-table tbody tr:last-child td { border-bottom: none; }
.orders-table tbody tr:hover td { background: #fafafa; }

.id-cell { color: #94a3b8; font-size: 12px; }

.agent-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
}

.user-type-pill {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.user-type-pill.employee { background: #dbeafe; color: #1d4ed8; }
.user-type-pill.client { background: #dcfce7; color: #15803d; }

.ticker { font-weight: 700; color: #0f172a; }
.sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }

.order-type-pill {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
}

.direction-pill {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
}
.direction-pill.buy { background: #dcfce7; color: #15803d; }
.direction-pill.sell { background: #fee2e2; color: #b91c1c; }

.status-pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.status-pill.pending   { background: #fef9c3; color: #854d0e; }
.status-pill.approved  { background: #dcfce7; color: #15803d; }
.status-pill.declined  { background: #fee2e2; color: #b91c1c; }
.status-pill.done      { background: #dbeafe; color: #1d4ed8; }
.status-pill.cancelled { background: #f1f5f9; color: #64748b; }

.remaining-zero { color: #94a3b8; }

/* --- Actions --- */
.actions-cell { min-width: 160px; }

.btn-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.action-btn {
  padding: 5px 12px;
  border: none;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.action-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.action-btn.approve { background: #16a34a; color: #fff; }
.action-btn.approve:hover:not(:disabled) { background: #15803d; }

.action-btn.decline { background: #dc2626; color: #fff; }
.action-btn.decline:hover:not(:disabled) { background: #b91c1c; }

.action-btn.cancel { background: #f59e0b; color: #fff; }
.action-btn.cancel:hover:not(:disabled) { background: #d97706; }

.inline-error {
  font-size: 11px;
  color: #b91c1c;
  width: 100%;
  margin-bottom: 4px;
}

/* --- Empty / loading --- */
.empty-state {
  padding: 48px 32px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  text-align: center;
  color: #64748b;
}

@media (max-width: 960px) {
  .page-header { flex-direction: column; align-items: flex-start; }
}
</style>
