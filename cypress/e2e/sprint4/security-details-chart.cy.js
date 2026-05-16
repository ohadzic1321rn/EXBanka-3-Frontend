// BERZA-FE-10 — Security details page: hero, stats, chart period switcher, history table, refresh.

import { adminLogin } from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'
import { createAgent, loginEmployeeApi, DEFAULT_EMPLOYEE_PASSWORD } from '../helpers/actuary'
import { getListing } from '../helpers/market'

describe('BERZA-FE-10 — Security details, chart, history', () => {
  let agentToken

  beforeEach(() => {
    adminLogin().then((admin) =>
      createAgent(admin, `berza-fe10-${Date.now()}`).then((agent) => {
        loginEmployeeUi(agent.email, DEFAULT_EMPLOYEE_PASSWORD)
        return loginEmployeeApi(agent.email).then((token) => {
          agentToken = token
        })
      })
    )
  })

  it('opens AAPL details, switches periods, renders chart canvas and history table', () => {
    cy.then(() =>
      getListing(agentToken, 'AAPL').then((listing) => {
        expect(listing, 'AAPL listing exists').to.exist
      })
    )

    cy.visit('/securities/AAPL')
    cy.contains('.ticker-pill', 'AAPL').should('be.visible')
    cy.contains('h1', /.+/).should('be.visible')
    cy.contains('h2', 'Graf kretanja cene').should('be.visible')
    cy.contains('h2', 'Istorija kretanja cene').should('be.visible')

    cy.get('.period-bar .period-btn').should('have.length.gte', 4)
    cy.contains('.period-btn.active', '1M').should('exist')

    cy.contains('.period-btn', '1W').click().should('have.class', 'active')
    cy.contains('.period-btn', '1Y').click().should('have.class', 'active')
    cy.contains('.period-btn', '1M').click().should('have.class', 'active')

    cy.get('canvas').should('exist')

    cy.get('.history-table tbody tr').its('length').should('be.gte', 1)
    cy.get('.history-table thead th').then(($ths) => {
      const headers = [...$ths].map((th) => th.innerText.trim())
      expect(headers).to.include('Datum')
      expect(headers).to.include('Cena')
      expect(headers).to.include('Volume')
    })
  })

  it('Osvezi button fires a refresh request that returns the listing', () => {
    cy.intercept('GET', '/api/v1/listings/AAPL').as('refreshListing')
    cy.intercept('GET', '/api/v1/listings/AAPL/history').as('refreshHistory')

    cy.visit('/securities/AAPL')
    cy.contains('.ticker-pill', 'AAPL').should('be.visible')

    cy.contains('button', 'Osvezi').click()
    cy.wait('@refreshListing').its('response.statusCode').should('be.oneOf', [200, 304])
    cy.wait('@refreshHistory').its('response.statusCode').should('be.oneOf', [200, 304])
    cy.contains('button', 'Osvezi').should('not.be.disabled')
  })

  it('shows the empty/not-found state for a bogus ticker', () => {
    cy.visit('/securities/__NOPE__', { failOnStatusCode: false })
    cy.contains(/Trazena hartija nije pronadjena|Ucitavam detalje hartije/).should('be.visible')
  })
})
