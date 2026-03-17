import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAccountStore } from '../../stores/account'
import { accountApi } from '../../api/account'

vi.mock('../../api/account', () => ({
  accountApi: {
    create: vi.fn(),
    get: vi.fn(),
    listByClient: vi.fn(),
    listAll: vi.fn(),
    updateName: vi.fn(),
    updateLimits: vi.fn(),
  },
  CURRENCIES: [
    { id: 1, kod: 'RSD', naziv: 'Serbian Dinar' },
    { id: 2, kod: 'EUR', naziv: 'Euro' },
  ],
}))

const mockAccount = {
  id: '42', brojRacuna: '123456789012345678', clientId: '1',
  firmaId: '0', currencyId: '2', currencyKod: 'EUR',
  tip: 'tekuci', vrsta: 'licni', stanje: 0, raspolozivoStanje: 0,
  dnevniLimit: 100000, mesecniLimit: 1000000, naziv: '', status: 'aktivan',
}

const mockAccounts = [mockAccount, { ...mockAccount, id: '43', brojRacuna: '987654321098765432' }]

describe('useAccountStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // --- createAccount ---

  it('createAccount calls API and returns account on success', async () => {
    vi.mocked(accountApi.create).mockResolvedValueOnce({ data: { account: mockAccount } })

    const store = useAccountStore()
    const result = await store.createAccount({
      clientId: 1, currencyId: 2, tip: 'tekuci', vrsta: 'licni',
    })

    expect(accountApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 1, currencyId: 2, tip: 'tekuci', vrsta: 'licni' })
    )
    expect(result.id).toBe('42')
    expect(store.lastCreated?.id).toBe('42')
  })

  it('createAccount sets error and rethrows on API failure', async () => {
    vi.mocked(accountApi.create).mockRejectedValueOnce({
      response: { data: { message: 'devizni account cannot use RSD' } },
    })

    const store = useAccountStore()
    await expect(store.createAccount({ clientId: 1, currencyId: 1, tip: 'devizni', vrsta: 'licni' }))
      .rejects.toBeDefined()

    expect(store.error).toBe('devizni account cannot use RSD')
    expect(store.loading).toBe(false)
  })

  // --- fetchAllAccounts ---

  it('fetchAllAccounts sets accounts and total on success', async () => {
    vi.mocked(accountApi.listAll).mockResolvedValueOnce({
      data: { accounts: mockAccounts, total: '2' },
    })

    const store = useAccountStore()
    await store.fetchAllAccounts()

    expect(store.accounts).toHaveLength(2)
    expect(store.total).toBe(2)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('fetchAllAccounts sets error on API failure', async () => {
    vi.mocked(accountApi.listAll).mockRejectedValueOnce({
      response: { data: { message: 'Unauthorized' } },
    })

    const store = useAccountStore()
    await store.fetchAllAccounts()

    expect(store.accounts).toHaveLength(0)
    expect(store.error).toBe('Unauthorized')
  })

  it('fetchAllAccounts passes filters to API', async () => {
    vi.mocked(accountApi.listAll).mockResolvedValueOnce({
      data: { accounts: [], total: '0' },
    })

    const store = useAccountStore()
    store.setFilters({ tip: 'tekuci', vrsta: 'licni', status: 'aktivan' })
    await store.fetchAllAccounts()

    expect(accountApi.listAll).toHaveBeenCalledWith(
      expect.objectContaining({ tip: 'tekuci', vrsta: 'licni', status: 'aktivan' })
    )
  })

  // --- getAccount ---

  it('getAccount returns account detail', async () => {
    vi.mocked(accountApi.get).mockResolvedValueOnce({ data: { account: mockAccount } })

    const store = useAccountStore()
    const result = await store.getAccount('42')

    expect(result.id).toBe('42')
    expect(result.currencyKod).toBe('EUR')
  })

  // --- filters ---

  it('setFilters resets page to 1', () => {
    const store = useAccountStore()
    store.page = 5
    store.setFilters({ tip: 'devizni' })

    expect(store.page).toBe(1)
    expect(store.filters.tip).toBe('devizni')
  })

  it('clearFilters resets all filters and page', () => {
    const store = useAccountStore()
    store.setFilters({ tip: 'tekuci', vrsta: 'poslovni', status: 'blokiran' })
    store.page = 3
    store.clearFilters()

    expect(store.filters.tip).toBe('')
    expect(store.filters.vrsta).toBe('')
    expect(store.filters.status).toBe('')
    expect(store.page).toBe(1)
  })

  it('clearError resets error state', () => {
    const store = useAccountStore()
    store.error = 'some error'
    store.clearError()
    expect(store.error).toBe('')
  })
})
