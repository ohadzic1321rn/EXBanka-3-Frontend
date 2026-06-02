import api from './client'

export interface AuditLog {
  id: number
  created_at: string
  action: string
  actor_id: number
  resource_id?: number
  resource_type?: string
  old_value?: string
  new_value?: string
}

export const AUDIT_ACTIONS = [
  'AGENT_LIMIT_CHANGED',
  'AGENT_USED_LIMIT_RESET',
  'ORDER_APPROVED',
  'ORDER_DECLINED',
  'EMPLOYEE_PERMISSIONS_CHANGED',
  'TAX_COLLECTION_TRIGGERED',
] as const

export const auditLogApi = {
  list(params: {
    action?: string
    actorId?: number | string
    from?: string   // RFC3339, e.g. "2025-01-01T00:00:00Z"
    to?: string     // RFC3339
  }) {
    const p: Record<string, string | number> = {}
    if (params.action)   p.action  = params.action
    if (params.actorId)  p.actorId = params.actorId
    if (params.from)     p.from    = params.from
    if (params.to)       p.to      = params.to
    return api.get<{ audit_logs: AuditLog[]; count: number }>('/audit-logs', { params: p })
  },
}
