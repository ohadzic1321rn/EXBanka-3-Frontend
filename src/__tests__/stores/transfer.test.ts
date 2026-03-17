import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTransferStore } from '../../stores/transfer'
import { transferApi } from '../../api/transfer'

vi.mock('../../api/transfer', () => ({
  transferApi: {
    create: vi.fn(),
    listByClient: vi.fn(),
    listByAccount: vi.fn(),
    calculateExchange: vi.fn(),
  },
}))

const mockTransfers = [
  {
    id: '1',
    racunPosiljaocaId: '10',
    racunPrimaocaId: '20',
    iznos: 1000,
    valutaIznosa: 'RSD',
    konvertovaniIznos: 1000,
    kurs: 1,
    svrha: 'Test',
    status: 'uspesno',
    vremeTransakcije: '2026-03-01T10:00:00Z',
  },
  {
    id: '2',
    racunPosiljaocaId: '10',
    racunPrimaocaId: '30',
    iznos: 50,
    valutaIznosa: 'EUR',
    konvertovaniIznos: 6000,
    kurs: 120,
    svrha: 'Renta',
    status: 'uspesno',
    vremeTransakcije: '2026-03-02T12:00:00Z',
  },
]

describe('useTransferStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchByClient sets transfers on success', async () => {
    vi.mocked(transferApi.listByClient).mockResolvedValueOnce({
      data: { transfers: mockTransfers, total: 2 },
    })

    const store = useTransferStore()
    await store.fetchByClient('5')

    expect(store.transfers).toHaveLength(2)
    expect(store.total).toBe(2)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('fetchByClient calls API with correct clientId and pagination', async () => {
    vi.mocked(transferApi.listByClient).mockResolvedValueOnce({
      data: { transfers: [], total: 0 },
    })

    const store = useTransferStore()
    await store.fetchByClient('42', { status: 'uspesno' })

    expect(transferApi.listByClient).toHaveBeenCalledWith('42', {
      status: 'uspesno',
      page: 1,
      pageSize: 20,
    })
  })

  it('fetchByClient sets error on API failure', async () => {
    vi.mocked(transferApi.listByClient).mockRejectedValueOnce({
      response: { data: { message: 'Unauthorized' } },
    })

    const store = useTransferStore()
    await store.fetchByClient('5')

    expect(store.transfers).toHaveLength(0)
    expect(store.error).toBe('Unauthorized')
    expect(store.loading).toBe(false)
  })

  it('fetchByAccount sets transfers on success', async () => {
    vi.mocked(transferApi.listByAccount).mockResolvedValueOnce({
      data: { transfers: [mockTransfers[0]], total: 1 },
    })

    const store = useTransferStore()
    await store.fetchByAccount('10')

    expect(store.transfers).toHaveLength(1)
    expect(store.total).toBe(1)
  })

  it('fetchByAccount calls API with correct accountId', async () => {
    vi.mocked(transferApi.listByAccount).mockResolvedValueOnce({
      data: { transfers: [], total: 0 },
    })

    const store = useTransferStore()
    await store.fetchByAccount('99')

    expect(transferApi.listByAccount).toHaveBeenCalledWith('99', expect.objectContaining({ page: 1 }))
  })

  it('createTransfer returns created transfer', async () => {
    vi.mocked(transferApi.create).mockResolvedValueOnce({
      data: { transfer: mockTransfers[0] },
    })

    const store = useTransferStore()
    const result = await store.createTransfer({
      racunPosiljaocaId: 10,
      racunPrimaocaId: 20,
      iznos: 1000,
      svrha: 'Test',
    })

    expect(result).toEqual(mockTransfers[0])
  })

  it('sets loading true during fetch and false after', async () => {
    let resolve!: (v: any) => void
    vi.mocked(transferApi.listByClient).mockReturnValueOnce(
      new Promise(r => { resolve = r })
    )

    const store = useTransferStore()
    const promise = store.fetchByClient('5')
    expect(store.loading).toBe(true)

    resolve({ data: { transfers: [], total: 0 } })
    await promise
    expect(store.loading).toBe(false)
  })

  it('clearError resets error', async () => {
    vi.mocked(transferApi.listByClient).mockRejectedValueOnce({
      response: { data: { message: 'Error!' } },
    })

    const store = useTransferStore()
    await store.fetchByClient('5')
    expect(store.error).toBe('Error!')

    store.clearError()
    expect(store.error).toBe('')
  })
})
