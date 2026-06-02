<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { auditLogApi, AUDIT_ACTIONS, type AuditLog } from '../api/auditLog'

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

const actionFilter  = ref('')
const actorIdFilter = ref('')
const fromFilter    = ref('')   // YYYY-MM-DD from date input
const toFilter      = ref('')   // YYYY-MM-DD from date input

// ---------------------------------------------------------------------------
// Data state
// ---------------------------------------------------------------------------

const logs    = ref<AuditLog[]>([])
const total   = ref(0)
const loading = ref(false)
const error   = ref('')

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function loadLogs() {
  loading.value = true
  error.value   = ''
  try {
    const params: Parameters<typeof auditLogApi.list>[0] = {}

    if (actionFilter.value)  params.action  = actionFilter.value
    if (actorIdFilter.value) params.actorId = actorIdFilter.value

    // Convert YYYY-MM-DD → RFC3339 for the backend
    if (fromFilter.value) params.from = `${fromFilter.value}T00:00:00Z`
    if (toFilter.value)   params.to   = `${toFilter.value}T23:59:59Z`

    const res    = await auditLogApi.list(params)
    logs.value   = res.data.audit_logs ?? []
    total.value  = res.data.count ?? logs.value.length
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Greška pri učitavanju audit log-a.'
    logs.value  = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  actionFilter.value  = ''
  actorIdFilter.value = ''
  fromFilter.value    = ''
  toFilter.value      = ''
  loadLogs()
}

onMounted(loadLogs)

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('sr-RS', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function truncate(val: string | undefined, len = 60): string {
  if (!val) return '—'
  return val.length > len ? val.slice(0, len) + '…' : val
}

const ACTION_LABELS: Record<string, string> = {
  AGENT_LIMIT_CHANGED:           'Limit agenta promenjen',
  AGENT_USED_LIMIT_RESET:        'Iskorišćeni limit resetovan',
  ORDER_APPROVED:                'Nalog odobren',
  ORDER_DECLINED:                'Nalog odbijen',
  EMPLOYEE_PERMISSIONS_CHANGED:  'Dozvole zaposlenog promenjene',
  TAX_COLLECTION_TRIGGERED:      'Obračun poreza pokrenut',
}

function actionClass(action: string): string {
  if (action.includes('APPROVED'))   return 'badge-green'
  if (action.includes('DECLINED'))   return 'badge-red'
  if (action.includes('RESET'))      return 'badge-blue'
  if (action.includes('TRIGGERED'))  return 'badge-orange'
  if (action.includes('CHANGED'))    return 'badge-purple'
  return 'badge-gray'
}
</script>

<template>
  <div class="audit-page">
    <div class="page-header">
      <div>
        <h1>Audit log</h1>
        <p>Pregled privilegovanih akcija zaposlenih — dostupno supervizorima i adminima.</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">Tip akcije</label>
          <select v-model="actionFilter" class="filter-select">
            <option value="">Sve akcije</option>
            <option v-for="a in AUDIT_ACTIONS" :key="a" :value="a">
              {{ ACTION_LABELS[a] ?? a }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Actor ID</label>
          <input
            v-model="actorIdFilter"
            type="number"
            min="1"
            placeholder="npr. 42"
            class="filter-input filter-input-sm"
          />
        </div>

        <div class="filter-group">
          <label class="filter-label">Od datuma</label>
          <input
            v-model="fromFilter"
            type="date"
            class="filter-input"
          />
        </div>

        <div class="filter-group">
          <label class="filter-label">Do datuma</label>
          <input
            v-model="toFilter"
            type="date"
            class="filter-input"
          />
        </div>

        <div class="filter-actions">
          <button class="btn-primary" :disabled="loading" @click="loadLogs">
            {{ loading ? 'Učitavam...' : 'Filtriraj' }}
          </button>
          <button class="btn-outline" @click="clearFilters">Poništi</button>
        </div>
      </div>
    </div>

    <!-- Loading / error -->
    <div v-if="loading" class="empty-state">Učitavam audit zapise...</div>
    <div v-else-if="error" class="error-box">{{ error }}</div>

    <template v-else>
      <div class="summary-bar">
        {{ total }} {{ total === 1 ? 'zapis' : 'zapisa' }} pronađeno
      </div>

      <section class="panel">
        <div class="table-wrap">
          <table class="audit-table">
            <thead>
              <tr>
                <th class="col-time">Vreme</th>
                <th class="col-action">Akcija</th>
                <th class="col-actor">Actor ID</th>
                <th class="col-res">Resurs</th>
                <th class="col-old">Stara vrednost</th>
                <th class="col-new">Nova vrednost</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id">
                <td class="col-time">{{ fmtDate(log.created_at) }}</td>
                <td class="col-action">
                  <span class="action-badge" :class="actionClass(log.action)">
                    {{ ACTION_LABELS[log.action] ?? log.action }}
                  </span>
                </td>
                <td class="col-actor">{{ log.actor_id }}</td>
                <td class="col-res">
                  <template v-if="log.resource_type || log.resource_id">
                    <span class="res-type">{{ log.resource_type }}</span>
                    <span v-if="log.resource_id" class="res-id">#{{ log.resource_id }}</span>
                  </template>
                  <span v-else>—</span>
                </td>
                <td class="col-old mono" :title="log.old_value">{{ truncate(log.old_value) }}</td>
                <td class="col-new mono" :title="log.new_value">{{ truncate(log.new_value) }}</td>
              </tr>
              <tr v-if="logs.length === 0">
                <td colspan="6" class="empty-cell">Nema zapisa za odabrane filtere.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.audit-page {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

/* Filters */
.filters {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filter-select,
.filter-input {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  color: #1e293b;
  outline: none;
  transition: border-color 0.15s;
  height: 36px;
}
.filter-select:focus,
.filter-input:focus { border-color: #3b82f6; }

.filter-select { min-width: 220px; }
.filter-input  { width: 150px; }
.filter-input-sm { width: 100px; }

.filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-top: 1px;
}

.btn-primary {
  padding: 8px 20px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  height: 36px;
  transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline {
  padding: 8px 16px;
  background: transparent;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  height: 36px;
  transition: all 0.15s;
}
.btn-outline:hover { border-color: #94a3b8; color: #1e293b; }

/* Summary bar */
.summary-bar {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 12px;
}

/* Panel + table */
.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.table-wrap { overflow-x: auto; }

.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.audit-table th {
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

.audit-table td {
  padding: 12px 14px;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}

.audit-table tbody tr:last-child td { border-bottom: none; }
.audit-table tbody tr:hover td { background: #f8fafc; }

/* Column widths */
.col-time   { width: 150px; white-space: nowrap; font-size: 12px; color: #64748b; }
.col-action { width: 220px; }
.col-actor  { width: 80px;  text-align: center; font-weight: 600; }
.col-res    { width: 140px; }
.col-old, .col-new { max-width: 180px; }

/* Resource display */
.res-type {
  display: inline-block;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  margin-right: 4px;
}
.res-id { font-size: 12px; color: #64748b; }

/* Mono for old/new values */
.mono {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  color: #475569;
  word-break: break-all;
  cursor: help;
}

/* Action badges */
.action-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.badge-green  { background: #dcfce7; color: #15803d; }
.badge-red    { background: #fee2e2; color: #b91c1c; }
.badge-blue   { background: #dbeafe; color: #1d4ed8; }
.badge-orange { background: #ffedd5; color: #c2410c; }
.badge-purple { background: #ede9fe; color: #6d28d9; }
.badge-gray   { background: #f1f5f9; color: #475569; }

/* States */
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
  margin-bottom: 16px;
}

.empty-cell {
  text-align: center;
  color: #94a3b8;
  padding: 32px;
}
</style>
