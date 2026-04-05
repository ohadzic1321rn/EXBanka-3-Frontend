import clientApi from './clientAuth'
import employeeApi from './client'

// ---------------------------------------------------------------------------
// Types — mirror getUserSummary response from tax_http_handler.go
// ---------------------------------------------------------------------------

export interface TaxSummary {
  user_id: number
  user_type: string
  period: string
  total_unpaid: number
  paid_this_year: number
  record_count: number
}

// ---------------------------------------------------------------------------
// Client-facing API (uses client JWT)
// ---------------------------------------------------------------------------

export const clientTaxApi = {
  /** GET /api/v1/tax/summary/{userId}?userType=client&period=YYYY-MM */
  getSummary(userId: number, period?: string): Promise<{ data: TaxSummary }> {
    const params: Record<string, string> = { userType: 'client' }
    if (period) params.period = period
    return clientApi.get(`/api/v1/tax/summary/${userId}`, { params })
  },
}

// ---------------------------------------------------------------------------
// Employee-facing API (uses employee JWT)
// ---------------------------------------------------------------------------

export const employeeTaxApi = {
  /** GET /api/v1/tax/summary/{userId}?userType=employee&period=YYYY-MM */
  getSummary(userId: number, userType = 'employee', period?: string): Promise<{ data: TaxSummary }> {
    const params: Record<string, string> = { userType }
    if (period) params.period = period
    return employeeApi.get(`/api/v1/tax/summary/${userId}`, { params })
  },
}
