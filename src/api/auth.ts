import api from './client'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  logout: (accessToken: string, refreshToken?: string | null) =>
    axios.post(
      `${BASE}/auth/logout`,
      refreshToken ? { refreshToken } : {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    ),

  activateAccount: (token: string, password: string, passwordConfirm: string) =>
    api.post('/auth/activate', { token, password, passwordConfirm }),

  requestPasswordReset: (email: string) =>
    api.post('/auth/password-reset/request', { email }),

  resetPassword: (token: string, password: string, passwordConfirm: string) =>
    api.post('/auth/password-reset/confirm', { token, password, passwordConfirm }),
}
