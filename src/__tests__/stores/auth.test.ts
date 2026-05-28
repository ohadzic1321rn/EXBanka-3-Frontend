import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../stores/auth'
import { authApi } from '../../api/auth'

vi.mock('../../api/auth', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
  },
}))

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('logout revokes employee tokens and clears local session', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      data: {
        accessToken: 'employee-access',
        refreshToken: 'employee-refresh',
        employee: {
          id: '1',
          ime: 'Petar',
          prezime: 'Petrovic',
          email: 'petar@bank.com',
          username: 'petar',
          pozicija: 'Agent',
          permissions: ['employeeAgent'],
        },
      },
    })
    vi.mocked(authApi.logout).mockResolvedValueOnce({ data: { message: 'logged out' } })

    const store = useAuthStore()
    await store.login('petar@bank.com', 'password123')
    store.logout()

    expect(authApi.logout).toHaveBeenCalledWith('employee-access', 'employee-refresh')
    expect(store.isLoggedIn).toBe(false)
    expect(store.employee).toBeNull()
    expect(sessionStorage.getItem('access_token')).toBeNull()
    expect(sessionStorage.getItem('refresh_token')).toBeNull()
  })

  it('logout clears local session even if backend logout fails', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      data: {
        accessToken: 'employee-access',
        refreshToken: 'employee-refresh',
        employee: {
          id: '1',
          ime: 'Petar',
          prezime: 'Petrovic',
          email: 'petar@bank.com',
          username: 'petar',
          pozicija: 'Agent',
          permissions: ['employeeAgent'],
        },
      },
    })
    vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('redis unavailable'))

    const store = useAuthStore()
    await store.login('petar@bank.com', 'password123')
    store.logout()

    expect(store.isLoggedIn).toBe(false)
    expect(store.employee).toBeNull()
    expect(sessionStorage.getItem('access_token')).toBeNull()
  })
})
