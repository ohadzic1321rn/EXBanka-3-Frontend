import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useClientAuthStore } from '../../stores/clientAuth'
import { clientAuthApi } from '../../api/clientAuth'

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: {
    login: vi.fn(),
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
    store.logout()

    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.client).toBeNull()
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

    store.logout()
    expect(store.isLoggedIn).toBe(false)
  })
})
