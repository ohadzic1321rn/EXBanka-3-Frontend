import axios from 'axios'

const clientApiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
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
}

export default clientApiClient
