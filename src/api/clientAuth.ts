import axios from 'axios'
import { resolveApiUrl } from '../runtimeConfig'

const clientApiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

clientApiClient.interceptors.request.use((config) => {
  const path = (config.baseURL ?? '') + (config.url ?? '')
  config.baseURL = ''
  config.url = resolveApiUrl(path)

  const token = sessionStorage.getItem('client_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const clientAuthApi = {
  login(email: string, password: string) {
    return clientApiClient.post('/auth/client/login', { email, password })
  },
  logout(accessToken: string, refreshToken?: string | null) {
    return axios.post(
      resolveApiUrl('/api/v1/auth/client/logout'),
      refreshToken ? { refreshToken } : {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
  },
  activateAccount(token: string, password: string, passwordConfirm: string) {
    return clientApiClient.post('/auth/client/activate', { token, password, passwordConfirm })
  },
}

export default clientApiClient
