// AKTUAR-FE-5 — supervisor manages limits / used-limit / need-approval on /actuaries.

import { adminLogin } from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'
import {
  createAgent,
  createSupervisor,
  loginEmployeeApi,
  listActuaries,
  DEFAULT_EMPLOYEE_PASSWORD,
} from '../helpers/actuary'

describe('AKTUAR-FE-5 — Actuary management portal', () => {
  it('supervisor edits limit, resets used-limit, and toggles needApproval for an agent', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createSupervisor(token, 'fe5-sup')
      })
      .then((supervisor) => {
        ctx.supervisor = supervisor
        return createAgent(ctx.adminToken, 'fe5-agent')
      })
      .then((agent) => {
        ctx.agent = agent
        loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)

        cy.visit('/actuaries')
        cy.contains('h1', 'Aktuari i supervizori').should('be.visible')

        cy.get('.search-box input').clear().type(ctx.agent.email)
        cy.contains('.actuary-table tr', ctx.agent.email).as('agentRow')

        cy.get('@agentRow').find('.limit-input').clear().type('50000')
        cy.get('@agentRow').contains('button', 'Save').click()

        cy.get('@agentRow').find('.limit-input').should('have.value', '50000')

        cy.get('@agentRow').contains('button', 'Reset').click()
        cy.get('@agentRow').find('td').eq(4).should('contain', '0.00')

        cy.get('@agentRow').find('.approval-pill').then(($pill) => {
          const before = $pill.text().trim()
          cy.wrap($pill).click()
          cy.get('@agentRow').find('.approval-pill').should(($after) => {
            expect($after.text().trim()).to.not.equal(before)
          })
        })

        cy.then(() =>
          loginEmployeeApi(ctx.supervisor.email).then((token) =>
            listActuaries(token).then((entries) => {
              const row = entries.find((e) => String(e.employeeId) === String(ctx.agent.id))
              expect(row, 'agent in /actuaries listing').to.exist
              expect(row.limit, 'limit saved').to.eq(50000)
              expect(row.usedLimit, 'usedLimit reset').to.eq(0)
            })
          )
        )
      })
  })

  it('search input filters the list down to a single agent', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createSupervisor(token, 'fe5b-sup')
      })
      .then((supervisor) => {
        ctx.supervisor = supervisor
        return createAgent(ctx.adminToken, 'fe5b-a1', { ime: 'Filter', prezime: 'TargetOne' })
      })
      .then(() => createAgent(ctx.adminToken, 'fe5b-a2', { ime: 'Other', prezime: 'Person' }))
      .then(() => createAgent(ctx.adminToken, 'fe5b-a3', { ime: 'Another', prezime: 'Body' }))
      .then(() => {
        loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/actuaries')

        cy.get('.actuary-table tbody tr').its('length').should('be.gte', 3)

        cy.get('.search-box input').clear().type('TargetOne')
        cy.get('.actuary-table tbody tr').should('have.length', 1)
        cy.get('.actuary-table tbody tr').first().should('contain', 'TargetOne')
      })
  })

  it('non-supervisor employee is redirected from /actuaries', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createAgent(token, 'fe5-agent-only')
      })
      .then((agent) => {
        loginEmployeeUi(agent.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/actuaries')
        cy.url().should('match', /\/clients$/)
      })
  })
})
