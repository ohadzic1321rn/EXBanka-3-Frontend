import axios from 'axios'
import { resolveApiUrl } from '../runtimeConfig'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const path = (config.baseURL ?? '') + (config.url ?? '')
  config.baseURL = ''
  config.url = resolveApiUrl(path)

  const token = sessionStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = sessionStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const res = await axios.post(resolveApiUrl('/api/v1/auth/refresh'), { refreshToken: refresh })
          sessionStorage.setItem('access_token', res.data.accessToken)
          sessionStorage.setItem('refresh_token', res.data.refreshToken)
          original.headers.Authorization = `Bearer ${res.data.accessToken}`
          return api(original)
        } catch {
          sessionStorage.clear()
          window.location.href = '/login'
        }
      } else {
        sessionStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
