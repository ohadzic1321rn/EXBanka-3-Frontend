import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const clientApiClient = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
})

clientApiClient.interceptors.request.use((config) => {
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
      `${BASE}/auth/client/logout`,
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
