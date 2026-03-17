<script setup lang="ts">
import { ref } from 'vue'
import { clientManagementApi, type ClientListItem, type CreateClientPayload } from '../api/clientManagement'

const emit = defineEmits<{
  close: []
  selected: [clientId: string]
}>()

type Mode = 'search' | 'create'
const mode = ref<Mode>('search')

// --- search state ---
const searchQuery = ref('')
const searchResults = ref<ClientListItem[]>([])
const searching = ref(false)
const searchError = ref('')

async function handleSearch() {
  if (!searchQuery.value.trim()) return
  searching.value = true
  searchError.value = ''
  try {
    const res = await clientManagementApi.list({
      nameFilter: searchQuery.value,
      pageSize: 10,
    })
    searchResults.value = res.data.clients ?? []
    if (searchResults.value.length === 0) {
      searchError.value = 'No clients found.'
    }
  } catch (e: any) {
    searchError.value = e.response?.data?.message || 'Search failed.'
  } finally {
    searching.value = false
  }
}

function selectClient(client: ClientListItem) {
  emit('selected', client.id)
}

// --- create state ---
const createForm = ref({
  ime: '', prezime: '', datumRodjenja: '', pol: 'M',
  email: '', brojTelefona: '', adresa: '',
})
const createError = ref('')
const creating = ref(false)

async function handleCreate() {
  createError.value = ''
  if (!createForm.value.ime || !createForm.value.prezime || !createForm.value.email) {
    createError.value = 'First name, last name and email are required.'
    return
  }
  creating.value = true
  try {
    const payload: CreateClientPayload = {
      ime: createForm.value.ime,
      prezime: createForm.value.prezime,
      datumRodjenja: createForm.value.datumRodjenja
        ? Math.floor(new Date(createForm.value.datumRodjenja).getTime() / 1000)
        : 0,
      pol: createForm.value.pol,
      email: createForm.value.email,
      brojTelefona: createForm.value.brojTelefona,
      adresa: createForm.value.adresa,
    }
    const res = await clientManagementApi.create(payload)
    const newId = res.data.client?.id ?? res.data.id
    emit('selected', String(newId))
  } catch (e: any) {
    createError.value = e.response?.data?.message || 'Failed to create client.'
  } finally {
    creating.value = false
  }
}

function switchMode(m: Mode) {
  mode.value = m
  searchError.value = ''
  createError.value = ''
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Select Client</h2>
        <button class="modal-close" @click="emit('close')">✕</button>
      </div>

      <!-- Mode tabs -->
      <div style="display:flex;border-bottom:1px solid #e5e7eb;padding:0 24px">
        <button
          :style="{
            borderBottom: mode === 'search' ? '2px solid #3b82f6' : 'none',
            color: mode === 'search' ? '#3b82f6' : '#6b7280',
            background: 'none', borderRadius: 0, padding: '10px 16px', marginBottom: '-1px'
          }"
          @click="switchMode('search')"
        >Search Existing</button>
        <button
          :style="{
            borderBottom: mode === 'create' ? '2px solid #3b82f6' : 'none',
            color: mode === 'create' ? '#3b82f6' : '#6b7280',
            background: 'none', borderRadius: 0, padding: '10px 16px', marginBottom: '-1px'
          }"
          @click="switchMode('create')"
        >Create New</button>
      </div>

      <div class="modal-body">

        <!-- Search mode -->
        <template v-if="mode === 'search'">
          <div style="display:flex;gap:8px;margin-bottom:16px">
            <input
              v-model="searchQuery"
              placeholder="Search by name or email..."
              style="flex:1"
              @keyup.enter="handleSearch"
            />
            <button class="btn-primary" :disabled="searching" @click="handleSearch">
              {{ searching ? 'Searching...' : 'Search' }}
            </button>
          </div>

          <p v-if="searchError" class="global-error">{{ searchError }}</p>

          <div v-if="searchResults.length > 0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
            <div
              v-for="client in searchResults"
              :key="client.id"
              class="client-result-row"
              style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer"
              @click="selectClient(client)"
            >
              <div>
                <div style="font-weight:500">{{ client.ime }} {{ client.prezime }}</div>
                <div style="font-size:13px;color:#6b7280">{{ client.email }}</div>
              </div>
              <span :class="client.aktivan ? 'badge badge-green' : 'badge badge-red'">
                {{ client.aktivan ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>

          <p v-else-if="!searchError && !searching" style="color:#6b7280;font-size:13px;margin-top:8px">
            Enter a name or email and click Search.
          </p>
        </template>

        <!-- Create mode -->
        <template v-if="mode === 'create'">
          <div class="form-row">
            <div class="form-group">
              <label>First Name *</label>
              <input v-model="createForm.ime" placeholder="Ana" required />
            </div>
            <div class="form-group">
              <label>Last Name *</label>
              <input v-model="createForm.prezime" placeholder="Jović" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Email *</label>
              <input v-model="createForm.email" type="email" placeholder="ana@gmail.com" required />
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input v-model="createForm.brojTelefona" placeholder="0611234567" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Date of Birth</label>
              <input v-model="createForm.datumRodjenja" type="date" />
            </div>
            <div class="form-group">
              <label>Gender</label>
              <select v-model="createForm.pol">
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Address</label>
            <input v-model="createForm.adresa" placeholder="Street 1, City" />
          </div>

          <p v-if="createError" class="global-error">{{ createError }}</p>
        </template>

      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button
          v-if="mode === 'create'"
          class="btn-primary"
          :disabled="creating"
          @click="handleCreate"
        >
          {{ creating ? 'Creating...' : 'Create & Select' }}
        </button>
      </div>
    </div>
  </div>
</template>
