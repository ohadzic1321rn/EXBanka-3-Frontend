import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  clientManagementApi,
  type ClientListItem,
  type ClientDetail,
  type UpdateClientPayload,
} from '../api/clientManagement'

interface ClientFilters {
  emailFilter: string
  nameFilter: string
}

export const useClientStore = defineStore('client', () => {
  const clients = ref<ClientListItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = 20
  const filters = ref<ClientFilters>({ emailFilter: '', nameFilter: '' })
  const loading = ref(false)
  const error = ref('')

  async function fetchClients() {
    loading.value = true
    error.value = ''
    try {
      const res = await clientManagementApi.list({
        emailFilter: filters.value.emailFilter || undefined,
        nameFilter: filters.value.nameFilter || undefined,
        page: page.value,
        pageSize,
      })
      clients.value = res.data.clients ?? []
      total.value = Number(res.data.total ?? 0)
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Failed to load clients.'
    } finally {
      loading.value = false
    }
  }

  async function getClient(id: string): Promise<ClientDetail> {
    const res = await clientManagementApi.get(id)
    return res.data.client
  }

  async function updateClient(id: string, data: UpdateClientPayload) {
    await clientManagementApi.update(id, data)
    await fetchClients()
  }

  function setFilters(newFilters: Partial<ClientFilters>) {
    Object.assign(filters.value, newFilters)
    page.value = 1
  }

  function clearFilters() {
    filters.value = { emailFilter: '', nameFilter: '' }
    page.value = 1
  }

  return {
    clients,
    total,
    page,
    pageSize,
    filters,
    loading,
    error,
    fetchClients,
    getClient,
    updateClient,
    setFilters,
    clearFilters,
  }
})
