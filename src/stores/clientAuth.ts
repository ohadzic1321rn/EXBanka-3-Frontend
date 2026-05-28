import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { clientAuthApi } from '../api/clientAuth'

interface ClientInfo {
  id: string
  ime: string
  prezime: string
  email: string
  permissions: string[]
}

export const useClientAuthStore = defineStore('clientAuth', () => {
  const accessToken = ref<string | null>(sessionStorage.getItem('client_access_token'))
  const refreshToken = ref<string | null>(sessionStorage.getItem('client_refresh_token'))
  const client = ref<ClientInfo | null>(
    JSON.parse(sessionStorage.getItem('client') || 'null')
  )

  const isLoggedIn = computed(() => !!accessToken.value)
  const permissions = computed(() => client.value?.permissions ?? [])

  async function login(email: string, password: string) {
    const res = await clientAuthApi.login(email, password)
    const data = res.data
    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    client.value = data.client
    sessionStorage.setItem('client_access_token', data.accessToken)
    sessionStorage.setItem('client_refresh_token', data.refreshToken)
    sessionStorage.setItem('client', JSON.stringify(data.client))
  }

  function clearSession() {
    accessToken.value = null
    refreshToken.value = null
    client.value = null
    sessionStorage.removeItem('client_access_token')
    sessionStorage.removeItem('client_refresh_token')
    sessionStorage.removeItem('client')
  }

  function logout() {
    const tokenToRevoke = accessToken.value
    const refreshToRevoke = refreshToken.value

    clearSession()

    if (tokenToRevoke) {
      void clientAuthApi.logout(tokenToRevoke, refreshToRevoke).catch(() => {
        // Local logout must not be blocked by temporary backend/Redis issues.
      })
    }
  }

  function hasPermission(permission: string) {
    return permissions.value.includes(permission)
  }

  return {
    accessToken,
    refreshToken,
    client,
    isLoggedIn,
    permissions,
    login,
    logout,
    hasPermission,
  }
})
