import { API_BASE } from './banking.js'
import {
  activateEmployee,
  createEmployee,
  fetchMailhogLinkToken,
  updateEmployeePermissions,
} from './employee.js'

const DEFAULT_EMPLOYEE_PASSWORD = 'EmpPass12!'

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

export function createActivatedEmployee(adminToken, label, permissionNames, overrides = {}) {
  let employeeRef
  return createEmployee(adminToken, label, overrides)
    .then((employee) => {
      employeeRef = employee
      return updateEmployeePermissions(adminToken, employee.id, permissionNames)
    })
    .then(() => fetchMailhogLinkToken(employeeRef.email, 'Activate Your Bank Account', '/activate/'))
    .then((token) => activateEmployee(token, overrides.password || DEFAULT_EMPLOYEE_PASSWORD))
    .then(() => ({ ...employeeRef, password: overrides.password || DEFAULT_EMPLOYEE_PASSWORD }))
}

export function createAgent(adminToken, label, overrides = {}) {
  return createActivatedEmployee(
    adminToken,
    label,
    ['employeeAgent'],
    { pozicija: 'Agent', ...overrides }
  )
}

export function createSupervisor(adminToken, label, overrides = {}) {
  return createActivatedEmployee(
    adminToken,
    label,
    ['employeeAgent', 'employeeSupervisor'],
    { pozicija: 'Supervisor', ...overrides }
  )
}

export function loginEmployeeApi(email, password = DEFAULT_EMPLOYEE_PASSWORD) {
  return cy
    .request('POST', `${API_BASE}/auth/login`, { email, password })
    .its('body.accessToken')
}

export function listActuaries(token) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/actuaries`,
      headers: authHeader(token),
    })
    .then(({ body }) => body.actuaries || [])
}

export function getActuary(token, employeeId) {
  return listActuaries(token).then((actuaries) => {
    const match = actuaries.find((a) => String(a.employeeId) === String(employeeId))
    expect(match, `actuary entry for employee ${employeeId}`).to.exist
    return match
  })
}

export function setActuaryLimit(supervisorToken, employeeId, limit) {
  return cy.request({
    method: 'PUT',
    url: `${API_BASE}/actuaries/${employeeId}/limit`,
    headers: authHeader(supervisorToken),
    body: { limit },
  })
}

export function resetUsedLimit(supervisorToken, employeeId) {
  return cy.request({
    method: 'POST',
    url: `${API_BASE}/actuaries/${employeeId}/reset-used-limit`,
    headers: authHeader(supervisorToken),
  })
}

export function setNeedApproval(supervisorToken, employeeId, needApproval) {
  return cy.request({
    method: 'PUT',
    url: `${API_BASE}/actuaries/${employeeId}/need-approval`,
    headers: authHeader(supervisorToken),
    body: { needApproval },
  })
}

export { DEFAULT_EMPLOYEE_PASSWORD }
