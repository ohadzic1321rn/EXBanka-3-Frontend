import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useClientStore } from '../../stores/client'
import { clientManagementApi } from '../../api/clientManagement'

vi.mock('../../api/clientManagement', () => ({
  clientManagementApi: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  },
}))

const mockClients = [
  { id: '1', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', brojTelefona: '0611234567', adresa: 'Ulica 1', aktivan: true },
  { id: '2', ime: 'Marko', prezime: 'Petrović', email: 'marko@gmail.com', brojTelefona: '', adresa: '', aktivan: false },
]

describe('useClientStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchClients sets clients and total on success', async () => {
    vi.mocked(clientManagementApi.list).mockResolvedValueOnce({
      data: { clients: mockClients, total: '2' },
    })

    const store = useClientStore()
    await store.fetchClients()

    expect(store.clients).toHaveLength(2)
    expect(store.total).toBe(2)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('fetchClients sets error on API failure', async () => {
    vi.mocked(clientManagementApi.list).mockRejectedValueOnce({
      response: { data: { message: 'Unauthorized' } },
    })

    const store = useClientStore()
    await store.fetchClients()

    expect(store.clients).toHaveLength(0)
    expect(store.error).toBe('Unauthorized')
    expect(store.loading).toBe(false)
  })

  it('fetchClients passes filter params to API', async () => {
    vi.mocked(clientManagementApi.list).mockResolvedValueOnce({
      data: { clients: [], total: '0' },
    })

    const store = useClientStore()
    store.setFilters({ emailFilter: 'ana@gmail.com', nameFilter: 'Ana' })
    await store.fetchClients()

    expect(clientManagementApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ emailFilter: 'ana@gmail.com', nameFilter: 'Ana' })
    )
  })

  it('getClient returns client detail', async () => {
    const detail = { id: '1', ime: 'Ana', prezime: 'Jović', datumRodjenja: '1990-01-01', pol: 'F', email: 'ana@gmail.com', brojTelefona: '061', adresa: 'Ulica 1', aktivan: true }
    vi.mocked(clientManagementApi.get).mockResolvedValueOnce({ data: { client: detail } })

    const store = useClientStore()
    const result = await store.getClient('1')

    expect(result.email).toBe('ana@gmail.com')
  })

  it('updateClient calls API and refreshes list', async () => {
    vi.mocked(clientManagementApi.update).mockResolvedValueOnce({})
    vi.mocked(clientManagementApi.list).mockResolvedValueOnce({
      data: { clients: mockClients, total: '2' },
    })

    const store = useClientStore()
    await store.updateClient('1', {
      ime: 'Ana', prezime: 'Jović', datumRodjenja: 631152000,
      pol: 'F', email: 'ana@gmail.com', brojTelefona: '061', adresa: 'Ulica 1',
    })

    expect(clientManagementApi.update).toHaveBeenCalledWith('1', expect.any(Object))
    expect(clientManagementApi.list).toHaveBeenCalled()
  })

  it('setFilters resets page to 1', () => {
    const store = useClientStore()
    store.page = 3
    store.setFilters({ emailFilter: 'test@test.com' })

    expect(store.page).toBe(1)
    expect(store.filters.emailFilter).toBe('test@test.com')
  })

  it('clearFilters resets filters and page', () => {
    const store = useClientStore()
    store.setFilters({ emailFilter: 'x@x.com', nameFilter: 'Test' })
    store.page = 5
    store.clearFilters()

    expect(store.filters.emailFilter).toBe('')
    expect(store.filters.nameFilter).toBe('')
    expect(store.page).toBe(1)
  })
})
