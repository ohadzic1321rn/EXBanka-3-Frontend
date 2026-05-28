import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useClientAuthStore } from '../../stores/clientAuth'
import { clientAuthApi } from '../../api/clientAuth'

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: {
    login: vi.fn(),
    logout: vi.fn(),
  },
}))

describe('clientAuth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('login sets tokens and client info', async () => {
    vi.mocked(clientAuthApi.login).mockResolvedValueOnce({
      data: {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        client: {
          id: '1',
          ime: 'Ana',
          prezime: 'Jović',
          email: 'ana@gmail.com',
          permissions: ['client.basic'],
        },
      },
    })

    const store = useClientAuthStore()
    await store.login('ana@gmail.com', 'password123')

    expect(store.accessToken).toBe('test-access')
    expect(store.refreshToken).toBe('test-refresh')
    expect(store.client?.email).toBe('ana@gmail.com')
  })

  it('logout clears tokens and client info', async () => {
    vi.mocked(clientAuthApi.login).mockResolvedValueOnce({
      data: {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        client: { id: '1', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', permissions: [] },
      },
    })

    const store = useClientAuthStore()
    await store.login('ana@gmail.com', 'password123')
    vi.mocked(clientAuthApi.logout).mockResolvedValueOnce({ data: { message: 'logged out' } })

    store.logout()

    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.client).toBeNull()
    expect(clientAuthApi.logout).toHaveBeenCalledWith('test-access', 'test-refresh')
  })

  it('isLoggedIn is false initially and true after login, false after logout', async () => {
    vi.mocked(clientAuthApi.login).mockResolvedValueOnce({
      data: {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        client: { id: '1', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', permissions: [] },
      },
    })

    const store = useClientAuthStore()
    expect(store.isLoggedIn).toBe(false)

    await store.login('ana@gmail.com', 'password123')
    expect(store.isLoggedIn).toBe(true)

    vi.mocked(clientAuthApi.logout).mockResolvedValueOnce({ data: { message: 'logged out' } })

    store.logout()
    expect(store.isLoggedIn).toBe(false)
  })

  it('logout clears local state even if backend logout fails', async () => {
    vi.mocked(clientAuthApi.login).mockResolvedValueOnce({
      data: {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        client: { id: '1', ime: 'Ana', prezime: 'Jovic', email: 'ana@gmail.com', permissions: [] },
      },
    })
    vi.mocked(clientAuthApi.logout).mockRejectedValueOnce(new Error('redis unavailable'))

    const store = useClientAuthStore()
    await store.login('ana@gmail.com', 'password123')
    store.logout()

    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.client).toBeNull()
    expect(sessionStorage.getItem('client_access_token')).toBeNull()
  })

  it('exposes permissions and checks client trading access', async () => {
    vi.mocked(clientAuthApi.login).mockResolvedValueOnce({
      data: {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        client: {
          id: '1',
          ime: 'Ana',
          prezime: 'Jovic',
          email: 'ana@gmail.com',
          permissions: ['clientBasic', 'clientTrading'],
        },
      },
    })

    const store = useClientAuthStore()
    await store.login('ana@gmail.com', 'password123')

    expect(store.permissions).toEqual(['clientBasic', 'clientTrading'])
    expect(store.hasPermission('clientTrading')).toBe(true)
    expect(store.hasPermission('employeeAgent')).toBe(false)
  })
})
