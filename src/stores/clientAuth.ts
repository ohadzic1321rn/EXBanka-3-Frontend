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

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    client.value = null
    sessionStorage.removeItem('client_access_token')
    sessionStorage.removeItem('client_refresh_token')
    sessionStorage.removeItem('client')
  }

  return { accessToken, refreshToken, client, isLoggedIn, login, logout }
})
