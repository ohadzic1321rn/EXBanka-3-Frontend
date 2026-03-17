import { defineStore } from 'pinia'
import { ref } from 'vue'
import { transferApi, type TransferItem, type CreateTransferPayload, type TransferFilter } from '../api/transfer'

export const useTransferStore = defineStore('transfer', () => {
  const transfers = ref<TransferItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = 20
  const loading = ref(false)
  const error = ref('')

  async function createTransfer(data: CreateTransferPayload): Promise<TransferItem> {
    const res = await transferApi.create(data)
    return res.data.transfer
  }

  async function fetchByClient(clientId: string, filter: TransferFilter = {}) {
    loading.value = true
    error.value = ''
    try {
      const res = await transferApi.listByClient(clientId, { ...filter, page: page.value, pageSize })
      transfers.value = res.data.transfers ?? []
      total.value = Number(res.data.total ?? 0)
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Failed to load transfers.'
    } finally {
      loading.value = false
    }
  }

  async function fetchByAccount(accountId: string, filter: TransferFilter = {}) {
    loading.value = true
    error.value = ''
    try {
      const res = await transferApi.listByAccount(accountId, { ...filter, page: page.value, pageSize })
      transfers.value = res.data.transfers ?? []
      total.value = Number(res.data.total ?? 0)
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Failed to load transfers.'
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = ''
  }

  return { transfers, total, page, pageSize, loading, error, createTransfer, fetchByClient, fetchByAccount, clearError }
})
