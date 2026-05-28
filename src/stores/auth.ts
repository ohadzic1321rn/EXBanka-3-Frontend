import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api/auth'

interface EmployeeInfo {
  id: string
  ime: string
  prezime: string
  email: string
  username: string
  pozicija: string
  permissions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(sessionStorage.getItem('access_token'))
  const refreshToken = ref<string | null>(sessionStorage.getItem('refresh_token'))
  const employee = ref<EmployeeInfo | null>(
    JSON.parse(sessionStorage.getItem('employee') || 'null')
  )

  const isLoggedIn = computed(() => !!accessToken.value)
  const permissions = computed(() => employee.value?.permissions ?? [])

  const ROLE_LEVELS: Record<string, number> = {
    employeeAdmin: 4,
    employeeSupervisor: 3,
    employeeAgent: 2,
    employeeBasic: 1,
  }

  function hasPermission(perm: string): boolean {
    const requiredLevel = ROLE_LEVELS[perm] ?? 0
    if (requiredLevel > 0) {
      return permissions.value.some(p => (ROLE_LEVELS[p] ?? 0) >= requiredLevel)
    }
    return permissions.value.includes(perm)
  }

  function isAdmin(): boolean {
    return permissions.value.includes('employeeAdmin')
  }

  async function login(email: string, password: string) {
    const res = await authApi.login(email, password)
    const data = res.data
    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    employee.value = data.employee
    sessionStorage.setItem('access_token', data.accessToken)
    sessionStorage.setItem('refresh_token', data.refreshToken)
    sessionStorage.setItem('employee', JSON.stringify(data.employee))
  }

  function clearSession() {
    accessToken.value = null
    refreshToken.value = null
    employee.value = null
    sessionStorage.clear()
  }

  function logout() {
    const tokenToRevoke = accessToken.value
    const refreshToRevoke = refreshToken.value

    clearSession()

    if (tokenToRevoke) {
      void authApi.logout(tokenToRevoke, refreshToRevoke).catch(() => {
        // Local logout must not be blocked by temporary backend/Redis issues.
      })
    }
  }

  return { employee, isLoggedIn, permissions, hasPermission, isAdmin, login, logout }
})
