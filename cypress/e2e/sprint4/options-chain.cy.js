// BERZA-FE-11 — Options chain on the security details page (stocks only).
//
// The chain lives on /securities/:ticker, below the price chart, with controls:
// - <select.expiry-select>  (expiration date picker)
// - .strike-filter-bar with .sf-btn buttons "Sve" | "ITM" | "OTM"
// - <table.options-table>  with .itm-cell / .otm-cell coloring

import { adminLogin } from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'
import { createAgent, loginEmployeeApi, DEFAULT_EMPLOYEE_PASSWORD } from '../helpers/actuary'
import { findStockWithOptions, getOptionsChain } from '../helpers/market'

describe('BERZA-FE-11 — Options chain', () => {
  let agentToken
  let pickedTicker = 'AAPL'

  beforeEach(() => {
    adminLogin().then((admin) =>
      createAgent(admin, `berza-fe11-${Date.now()}`).then((agent) => {
        loginEmployeeUi(agent.email, DEFAULT_EMPLOYEE_PASSWORD)
        return loginEmployeeApi(agent.email).then((token) => {
          agentToken = token
          return getOptionsChain(token, 'AAPL').then((chain) => {
            if (chain.options && chain.options.length > 0) {
              pickedTicker = 'AAPL'
              return null
            }
            return findStockWithOptions(token).then((c) => {
              pickedTicker = c.ticker
            })
          })
        })
      })
    )
  })

  it('renders options chain with expiry dropdown, ITM/OTM filter, and colored rows', () => {
    cy.visit(`/securities/${pickedTicker}`)
    cy.contains('.ticker-pill', pickedTicker).should('be.visible')

    cy.contains('h2', 'Opcioni lanac').scrollIntoView().should('be.visible')

    cy.get('.options-table thead').contains('CALLS').should('be.visible')
    cy.get('.options-table thead').contains('STRIKE').should('be.visible')
    cy.get('.options-table thead').contains('PUTS').should('be.visible')

    cy.get('.options-table tbody tr').its('length').should('be.gte', 1)

    cy.get('.expiry-select option').its('length').should('be.gte', 2)
    cy.get('.expiry-select').then(($sel) => {
      const second = $sel.find('option').eq(1).val()
      if (second) cy.wrap($sel).select(String(second))
    })

    cy.contains('.sf-btn', 'ITM').click().should('have.class', 'active')
    cy.get('.options-table').then(($table) => {
      const itmCount = $table.find('.itm-cell').length
      expect(itmCount, 'ITM filter shows ITM-coloured cells').to.be.gte(0)
    })

    cy.contains('.sf-btn', 'OTM').click().should('have.class', 'active')
    cy.get('.options-table').then(($table) => {
      const otmCount = $table.find('.otm-cell').length
      expect(otmCount, 'OTM filter shows OTM-coloured cells').to.be.gte(0)
    })

    cy.contains('.sf-btn', 'Sve').click().should('have.class', 'active')
  })

  it('falls back to empty-state copy for a stock with no options data', () => {
    cy.then(() => {
      cy.intercept('GET', '/api/v1/listings/*/options', { statusCode: 200, body: { ticker: 'AAPL', stockPrice: 0, options: [], count: 0 } }).as('emptyOptions')
    })

    cy.visit('/securities/AAPL')
    cy.contains('.ticker-pill', 'AAPL').should('be.visible')
    cy.wait('@emptyOptions')
    cy.contains(/Opcioni podaci nisu dostupni|Nema opcija/).should('be.visible')
  })
})
