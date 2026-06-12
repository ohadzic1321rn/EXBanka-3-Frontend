// Sprint 8 — Cenovni alarmi (price alerts).
//
// Covers the client-facing price-alert feature end-to-end through the UI:
//   - ALERT-FE: set an ABOVE / BELOW alarm from the security-details page.
//   - ALERT-FE: the "Cenovni alarmi" page lists active alarms with the right
//     condition badge, threshold, and notification email (captured from JWT).
//   - ALERT-FE/BE: removing an alarm deactivates it and empties the list.
//
// A trading-enabled client is provisioned via the admin API; everything else
// is driven through the browser. DB assertions confirm persistence.

import {
  adminLogin,
  createClient,
  activateClient,
  loginClientUi,
} from '../helpers/banking'
import { grantClientTrading } from '../helpers/otc'
import { lookupListingId } from '../helpers/orders'

const TICKER = 'AAPL'
const ABOVE_THRESHOLD = 999.99
const BELOW_THRESHOLD = 50

function fetchAlerts(clientId) {
  return cy
    .task('dbExec', {
      sql: `SELECT ticker, condition, threshold::float AS threshold,
                   notification_email, is_active
            FROM price_alerts
            WHERE user_id = $1 AND user_type = 'client'
            ORDER BY id`,
      params: [Number(clientId)],
    })
    .then(({ rows }) => rows)
}

function setAlarm(condition, threshold) {
  cy.visit(`/client/securities/${TICKER}`)
  cy.contains('.ticker-pill', TICKER).should('be.visible')
  cy.get('.alert-form select').select(condition)
  cy.get('.alert-form input[type="number"]').clear().type(String(threshold))
  cy.contains('.alert-form button', 'Postavi alarm').click()
  cy.contains('.alert-msg-ok', 'Alarm uspešno postavljen!').should('be.visible')
}

describe('Sprint 8 — Cenovni alarmi', () => {
  beforeEach(function () {
    this.ctx = {}
    adminLogin()
      .then((token) => {
        this.ctx.adminToken = token
        return lookupListingId(TICKER)
      })
      .then(() => createClient(this.ctx.adminToken, 's8-alerts'))
      .then((client) => {
        this.ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => grantClientTrading(this.ctx.adminToken, this.ctx.client.id))
      .then(() => {
        loginClientUi(this.ctx.client.email)
      })
  })

  it('Klijent postavlja ABOVE alarm i vidi ga na stranici alarma', function () {
    const ctx = this.ctx

    setAlarm('ABOVE', ABOVE_THRESHOLD)

    cy.visit('/client/price-alerts')
    cy.contains('h1', 'Cenovni alarmi').should('be.visible')
    cy.contains('.summary-bar', '1 aktivan alarm').should('be.visible')

    cy.contains('.alerts-table tr', TICKER).within(() => {
      cy.get('.col-ticker').should('contain', TICKER)
      cy.contains('.cond-badge', 'Iznad').should('be.visible')
      cy.get('.col-threshold').should('contain', ABOVE_THRESHOLD.toFixed(2))
      cy.get('.col-email').should('contain', ctx.client.email)
    })

    // Persisted with the email captured from the JWT.
    cy.then(() => fetchAlerts(ctx.client.id)).then((alerts) => {
      expect(alerts).to.have.length(1)
      expect(alerts[0].condition).to.eq('ABOVE')
      expect(Number(alerts[0].threshold)).to.be.closeTo(ABOVE_THRESHOLD, 0.001)
      expect(alerts[0].notification_email).to.eq(ctx.client.email)
      expect(alerts[0].is_active).to.eq(true)
    })
  })

  it('ABOVE i BELOW alarmi prikazuju ispravne bedzeve; uklanjanje prazni listu', function () {
    const ctx = this.ctx

    setAlarm('ABOVE', ABOVE_THRESHOLD)
    setAlarm('BELOW', BELOW_THRESHOLD)

    cy.visit('/client/price-alerts')
    cy.contains('.summary-bar', '2 aktivnih alarma').should('be.visible')
    cy.contains('.cond-badge', 'Iznad').should('be.visible')
    cy.contains('.cond-badge', 'Ispod').should('be.visible')

    // Remove the first alarm row.
    cy.get('.alerts-table tbody tr').should('have.length', 2)
    cy.get('.alerts-table tbody tr').first().within(() => {
      cy.contains('button', 'Ukloni').click()
    })
    cy.get('.alerts-table tbody tr').should('have.length', 1)

    // Remove the last one -> empty state.
    cy.get('.alerts-table tbody tr').first().within(() => {
      cy.contains('button', 'Ukloni').click()
    })
    cy.contains('Nemate aktivnih alarma').should('be.visible')

    // DB: both alarms deactivated (the list endpoint only returns active ones).
    cy.then(() => fetchAlerts(ctx.client.id)).then((alerts) => {
      const active = alerts.filter((a) => a.is_active === true)
      expect(active, 'no active alarms remain').to.have.length(0)
    })
  })

  it('Prag mora biti pozitivan', function () {
    cy.visit(`/client/securities/${TICKER}`)
    cy.contains('.ticker-pill', TICKER).should('be.visible')
    // Leave threshold empty and submit -> client-side validation error.
    cy.contains('.alert-form button', 'Postavi alarm').click()
    cy.contains('.alert-msg-err', 'Unesi pozitivan prag cene.').should('be.visible')
  })
})
