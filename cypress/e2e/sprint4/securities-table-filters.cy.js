// BERZA-FE-9 — Securities table: tabs, search, range filter, sort, refresh.

import {
  adminLogin,
  createClient,
  activateClient,
  updateClientPermissions,
  loginClientUi,
} from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'
import { createAgent, DEFAULT_EMPLOYEE_PASSWORD } from '../helpers/actuary'

describe('BERZA-FE-9 — Securities table filters and sort', () => {
  it('employee with trading permissions can switch tabs, search, sort, and clear filters', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createAgent(token, 'berza-fe9-agent')
      })
      .then((agent) => {
        loginEmployeeUi(agent.email, DEFAULT_EMPLOYEE_PASSWORD)

        cy.visit('/securities')
        cy.contains('h1', 'Hartije od vrednosti').should('be.visible')

        cy.get('.tab-bar .tab-btn').should('have.length', 4)
        cy.get('.tab-bar .tab-btn').eq(0).should('contain', 'Sve')
        cy.get('.tab-bar .tab-btn').eq(1).should('contain', 'Akcije')
        cy.get('.tab-bar .tab-btn').eq(2).should('contain', 'Forex')
        cy.get('.tab-bar .tab-btn').eq(3).should('contain', 'Futures')

        cy.contains('.tab-btn', 'Akcije').click().should('have.class', 'active')
        cy.get('.market-table tbody tr').each(($row) => {
          cy.wrap($row).find('.type-pill').should('contain.text', 'stock')
        })

        cy.contains('.tab-btn', 'Sve').click()
        cy.get('.search-input').clear().type('AAPL')
        cy.get('.market-table tbody tr').should('have.length.gte', 1)
        cy.get('.market-table tbody tr').first().find('.ticker').should('contain', 'AAPL')
        cy.get('.search-input').clear()

        cy.get('.sort-select').select('priceDesc')
        cy.get('.market-table tbody tr').then(($rows) => {
          if ($rows.length < 2) return
          const first = parseFloat($rows.eq(0).find('td').eq(3).text().replace(/[^\d.\-]/g, ''))
          const second = parseFloat($rows.eq(1).find('td').eq(3).text().replace(/[^\d.\-]/g, ''))
          expect(first, 'first price ≥ second price').to.be.gte(second)
        })

        cy.get('.range-group').contains('Cena').parent().within(() => {
          cy.get('input[placeholder="Min"]').type('100')
          cy.get('input[placeholder="Max"]').type('500')
        })

        cy.contains('button', 'Ocisti filtere').should('be.visible').click()
        cy.contains('button', 'Ocisti filtere').should('not.exist')
      })
  })

  it('trading client sees the four security tabs on /client/securities', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createClient(token, 'berza-fe9-trader')
      })
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => updateClientPermissions(ctx.adminToken, ctx.client.id, ['clientBasic', 'clientTrading']))
      .then(() => {
        loginClientUi(ctx.client.email)
        cy.visit('/client/securities')
        cy.contains('Hartije').should('be.visible')

        cy.get('.tab-bar .tab-btn').should('have.length', 4)
        cy.contains('.tab-btn', 'Akcije').should('be.visible')
        cy.contains('.tab-btn', 'Futures').should('be.visible')
      })
  })

  it('basic client without clientTrading is redirected from /client/securities', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createClient(token, 'berza-fe9-basic')
      })
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => updateClientPermissions(ctx.adminToken, ctx.client.id, ['clientBasic']))
      .then(() => {
        loginClientUi(ctx.client.email)
        cy.visit('/client/securities')
        cy.url().should('match', /\/client\/dashboard$/)
      })
  })
})
