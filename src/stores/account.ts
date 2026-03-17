import { defineStore } from 'pinia'
import { ref } from 'vue'
import { accountApi, type CreateAccountPayload, type AccountProto } from '../api/account'

interface AccountFilters {
  clientName: string
  tip: string
  vrsta: string
  status: string
  currencyId: number | undefined
}

export const useAccountStore = defineStore('account', () => {
  // create state
  const lastCreated = ref<AccountProto | null>(null)
  const loading = ref(false)
  const error = ref('')

  // list state
  const accounts = ref<AccountProto[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = 20
  const filters = ref<AccountFilters>({
    clientName: '', tip: '', vrsta: '', status: '', currencyId: undefined,
  })

  async function createAccount(data: CreateAccountPayload): Promise<AccountProto> {
    loading.value = true
    error.value = ''
    try {
      const res = await accountApi.create(data)
      const account = res.data.account
      lastCreated.value = account
      return account
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Failed to create account.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAllAccounts() {
    loading.value = true
    error.value = ''
    try {
      const res = await accountApi.listAll({
        clientName: filters.value.clientName || undefined,
        tip:        filters.value.tip || undefined,
        vrsta:      filters.value.vrsta || undefined,
        status:     filters.value.status || undefined,
        currencyId: filters.value.currencyId,
        page:       page.value,
        pageSize,
      })
      accounts.value = res.data.accounts ?? []
      total.value = Number(res.data.total ?? 0)
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Failed to load accounts.'
    } finally {
      loading.value = false
    }
  }

  async function getAccount(id: string): Promise<AccountProto> {
    const res = await accountApi.get(id)
    return res.data.account
  }

  function setFilters(newFilters: Partial<AccountFilters>) {
    Object.assign(filters.value, newFilters)
    page.value = 1
  }

  function clearFilters() {
    filters.value = { clientName: '', tip: '', vrsta: '', status: '', currencyId: undefined }
    page.value = 1
  }

  function clearError() {
    error.value = ''
  }

  return {
    lastCreated, loading, error,
    accounts, total, page, pageSize, filters,
    createAccount, fetchAllAccounts, getAccount,
    setFilters, clearFilters, clearError,
  }
})
