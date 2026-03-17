<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { clientManagementApi, type ClientDetail, type UpdateClientPayload } from '../api/clientManagement'
import { useClientStore } from '../stores/client'

const store = useClientStore()

const editingClient = ref<ClientDetail | null>(null)
const editForm = ref<UpdateClientPayload & { datumRodjenjaStr: string }>({
  ime: '', prezime: '', datumRodjenja: 0, datumRodjenjaStr: '',
  pol: 'M', email: '', brojTelefona: '', adresa: '',
})
const editError = ref('')
const editLoading = ref(false)

async function openEdit(clientId: string) {
  try {
    const detail = await store.getClient(clientId)
    editingClient.value = detail
    editForm.value = {
      ime: detail.ime,
      prezime: detail.prezime,
      datumRodjenja: 0,
      datumRodjenjaStr: detail.datumRodjenja ? detail.datumRodjenja.substring(0, 10) : '',
      pol: detail.pol || 'M',
      email: detail.email,
      brojTelefona: detail.brojTelefona || '',
      adresa: detail.adresa || '',
    }
    editError.value = ''
  } catch {
    store.error = 'Failed to load client details.'
  }
}

async function handleSave() {
  if (!editingClient.value) return
  editError.value = ''
  editLoading.value = true
  try {
    const payload: UpdateClientPayload = {
      ime: editForm.value.ime,
      prezime: editForm.value.prezime,
      datumRodjenja: editForm.value.datumRodjenjaStr
        ? Math.floor(new Date(editForm.value.datumRodjenjaStr).getTime() / 1000)
        : 0,
      pol: editForm.value.pol,
      email: editForm.value.email,
      brojTelefona: editForm.value.brojTelefona,
      adresa: editForm.value.adresa,
    }
    await store.updateClient(editingClient.value.id, payload)
    editingClient.value = null
  } catch (e: any) {
    editError.value = e.response?.data?.message || 'Failed to save changes.'
  } finally {
    editLoading.value = false
  }
}

function applyFilters() {
  store.setFilters({
    emailFilter: store.filters.emailFilter,
    nameFilter: store.filters.nameFilter,
  })
  store.fetchClients()
}

function clearFilters() {
  store.clearFilters()
  store.fetchClients()
}

const totalPages = () => Math.ceil(store.total / store.pageSize)

onMounted(() => store.fetchClients())
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>Clients</h1>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input
        v-model="store.filters.emailFilter"
        placeholder="Filter by email"
        @keyup.enter="applyFilters"
      />
      <input
        v-model="store.filters.nameFilter"
        placeholder="Filter by name"
        @keyup.enter="applyFilters"
      />
      <button class="btn-primary" @click="applyFilters">Search</button>
      <button class="btn-secondary" @click="clearFilters">Clear</button>
    </div>

    <p v-if="store.error" class="global-error" style="margin-bottom:12px">{{ store.error }}</p>

    <!-- Table -->
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="store.loading">
            <td colspan="5" style="text-align:center;padding:24px;color:#6b7280">Loading...</td>
          </tr>
          <tr v-else-if="store.clients.length === 0">
            <td colspan="5" style="text-align:center;padding:24px;color:#6b7280">No clients found.</td>
          </tr>
          <tr v-for="client in store.clients" :key="client.id">
            <td>
              <div style="font-weight:500">{{ client.ime }} {{ client.prezime }}</div>
            </td>
            <td>{{ client.email }}</td>
            <td>{{ client.brojTelefona || '—' }}</td>
            <td>
              <span :class="client.aktivan ? 'badge badge-green' : 'badge badge-red'">
                {{ client.aktivan ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <div class="table-actions">
                <button class="btn-primary btn-sm" @click="openEdit(client.id)">Edit</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="store.total > store.pageSize" class="pagination">
      <button class="btn-secondary btn-sm" :disabled="store.page <= 1" @click="store.page--; store.fetchClients()">←</button>
      <span>Page {{ store.page }} of {{ totalPages() }} ({{ store.total }} total)</span>
      <button class="btn-secondary btn-sm" :disabled="store.page >= totalPages()" @click="store.page++; store.fetchClients()">→</button>
    </div>
  </div>

  <!-- Edit dialog -->
  <div v-if="editingClient" class="modal-overlay" @click.self="editingClient = null">
    <div class="modal">
      <div class="modal-header">
        <h2>Edit Client</h2>
        <button class="modal-close" @click="editingClient = null">✕</button>
      </div>

      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>First Name *</label>
            <input v-model="editForm.ime" required />
          </div>
          <div class="form-group">
            <label>Last Name *</label>
            <input v-model="editForm.prezime" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Date of Birth</label>
            <input v-model="editForm.datumRodjenjaStr" type="date" />
          </div>
          <div class="form-group">
            <label>Gender</label>
            <select v-model="editForm.pol">
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Email *</label>
            <input v-model="editForm.email" type="email" required />
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input v-model="editForm.brojTelefona" />
          </div>
        </div>

        <div class="form-group">
          <label>Address</label>
          <input v-model="editForm.adresa" />
        </div>

        <p v-if="editError" class="global-error">{{ editError }}</p>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="editingClient = null">Cancel</button>
        <button class="btn-primary" @click="handleSave" :disabled="editLoading">
          {{ editLoading ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>
