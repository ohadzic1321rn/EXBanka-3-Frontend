// Sprint 8 — Audit log privilegovanih akcija.
//
// Covers the supervisor/admin-only audit log:
//   - AUDIT-BE: a privileged action (changing an employee's permissions)
//     writes an EMPLOYEE_PERMISSIONS_CHANGED row with actor + resource.
//   - AUDIT-FE: supervisor opens /audit-logs and sees the row; action and
//     actor-id filters narrow the result; "Poništi" restores it.
//   - AUDIT-FE: a non-supervisor employee is bounced off the route.
//
// The audited action is produced by the real admin API (createSupervisor /
// createAgent both PUT /employees/:id/permissions), so the row under test is
// a genuine side-effect rather than seeded data.

import { adminLogin } from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'
import { createSupervisor, createAgent, DEFAULT_EMPLOYEE_PASSWORD } from '../helpers/actuary'

const PERMS_CHANGED_LABEL = 'Dozvole zaposlenog promenjene'

function fetchAdminId() {
  return cy
    .task('dbExec', {
      sql: 'SELECT id FROM employees WHERE email = $1 LIMIT 1',
      params: [Cypress.env('adminEmail')],
    })
    .then(({ rows }) => {
      expect(rows[0], 'admin employee row').to.exist
      return Number(rows[0].id)
    })
}

describe('Sprint 8 — Audit log', () => {
  it('Supervizor vidi audit zapis promene dozvola i moze da filtrira', function () {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return fetchAdminId()
      })
      .then((adminId) => {
        ctx.adminId = adminId
        // Activating the supervisor PUTs its permissions -> audited action.
        return createSupervisor(ctx.adminToken, 's8-audit-sup')
      })
      .then((sup) => {
        ctx.sup = sup

        loginEmployeeUi(sup.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/audit-logs')

        cy.contains('h1', 'Audit log').should('be.visible')
        cy.contains('.summary-bar', 'pronađeno').should('be.visible')

        // The supervisor's own permission-grant is in the log: resource
        // "employee #<id>" with the perms-changed action badge.
        cy.contains('.audit-table tr', `#${sup.id}`).within(() => {
          cy.contains('.action-badge', PERMS_CHANGED_LABEL).should('be.visible')
          cy.contains('.res-type', 'employee').should('be.visible')
        })

        // Filter by action -> every visible row is a permissions change.
        cy.get('.filter-select').select(PERMS_CHANGED_LABEL)
        cy.contains('button', 'Filtriraj').click()
        cy.get('.action-badge').should('have.length.greaterThan', 0)
        cy.get('.action-badge').each(($b) => {
          expect($b.text().trim()).to.eq(PERMS_CHANGED_LABEL)
        })

        // Filter by the admin actor id -> the row is still there.
        cy.get('input[placeholder="npr. 42"]').clear().type(String(ctx.adminId))
        cy.contains('button', 'Filtriraj').click()
        cy.contains('.audit-table tr', `#${sup.id}`).should('be.visible')

        // A non-existent actor id -> empty result.
        cy.get('input[placeholder="npr. 42"]').clear().type('99999999')
        cy.contains('button', 'Filtriraj').click()
        cy.contains('Nema zapisa za odabrane filtere.').should('be.visible')

        // Reset filters -> rows return.
        cy.contains('button', 'Poništi').click()
        cy.contains('.audit-table tr', `#${sup.id}`).should('be.visible')
      })
  })

  it('Zaposleni bez supervisor dozvole ne moze da otvori audit log', function () {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createAgent(token, 's8-audit-agent')
      })
      .then((agent) => {
        loginEmployeeUi(agent.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/audit-logs')

        // Route guard (employeeSupervisorOnly) bounces agents to /clients.
        cy.url().should('match', /\/clients$/)
        cy.contains('h1', 'Audit log').should('not.exist')
      })
  })
})
