<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { priceAlertApi, type PriceAlert } from '../../api/priceAlert'

const alerts = ref<PriceAlert[]>([])
const loading = ref(false)
const error = ref('')
const deletingId = ref<number | null>(null)

async function loadAlerts() {
  loading.value = true
  error.value = ''
  try {
    const res = await priceAlertApi.list()
    alerts.value = res.data ?? []
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Greška pri učitavanju alertova.'
    alerts.value = []
  } finally {
    loading.value = false
  }
}

async function removeAlert(id: number) {
  deletingId.value = id
  try {
    await priceAlertApi.remove(id)
    alerts.value = alerts.value.filter((a) => a.id !== id)
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Greška pri brisanju alerta.'
  } finally {
    deletingId.value = null
  }
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('sr-RS', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(loadAlerts)
</script>

<template>
  <div class="alerts-page">
    <div class="page-header">
      <div>
        <h1>Cenovni alarmi</h1>
        <p>Aktivni alertovi — obaveštenje stiže na email kad se uslov ispuni.</p>
      </div>
    </div>

    <div v-if="loading" class="empty-state">Učitavam alarme...</div>
    <div v-else-if="error" class="error-box">{{ error }}</div>
    <template v-else>
      <div class="summary-bar">
        {{ alerts.length }} {{ alerts.length === 1 ? 'aktivan alarm' : 'aktivnih alarma' }}
      </div>

      <section class="panel">
        <div v-if="alerts.length === 0" class="empty-inline">
          Nemate aktivnih alarma. Postavite alarm na stranici hartije.
        </div>
        <div v-else class="table-wrap">
          <table class="alerts-table">
            <thead>
              <tr>
                <th>Hartija</th>
                <th>Uslov</th>
                <th>Prag</th>
                <th>Email</th>
                <th>Postavljeno</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="alert in alerts" :key="alert.id">
                <td class="col-ticker">{{ alert.ticker }}</td>
                <td>
                  <span :class="['cond-badge', alert.condition === 'ABOVE' ? 'badge-green' : 'badge-red']">
                    {{ alert.condition === 'ABOVE' ? '↑ Iznad' : '↓ Ispod' }}
                  </span>
                </td>
                <td class="col-threshold">{{ alert.threshold.toFixed(2) }}</td>
                <td class="col-email">{{ alert.notification_email }}</td>
                <td class="col-date">{{ fmtDate(alert.created_at) }}</td>
                <td class="col-action">
                  <button
                    class="btn-delete"
                    :disabled="deletingId === alert.id"
                    @click="removeAlert(alert.id)"
                  >
                    {{ deletingId === alert.id ? '...' : 'Ukloni' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.alerts-page {
  padding: 32px;
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
}

.page-header p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.summary-bar {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 12px;
}

.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.table-wrap { overflow-x: auto; }

.alerts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.alerts-table th {
  background: #f8fafc;
  padding: 11px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.alerts-table td {
  padding: 13px 14px;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.alerts-table tbody tr:last-child td { border-bottom: none; }
.alerts-table tbody tr:hover td { background: #f8fafc; }

.col-ticker { font-weight: 700; font-size: 14px; }
.col-threshold { font-weight: 600; font-family: 'Courier New', monospace; }
.col-email { color: #64748b; font-size: 12px; }
.col-date { color: #94a3b8; font-size: 12px; white-space: nowrap; }
.col-action { width: 80px; text-align: right; }

.cond-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.badge-green { background: #dcfce7; color: #15803d; }
.badge-red   { background: #fee2e2; color: #b91c1c; }

.btn-delete {
  padding: 5px 12px;
  background: transparent;
  color: #ef4444;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-delete:hover:not(:disabled) { background: #fef2f2; border-color: #ef4444; }
.btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-inline {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #64748b;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.error-box {
  padding: 16px 20px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #991b1b;
  font-size: 14px;
}
</style>
