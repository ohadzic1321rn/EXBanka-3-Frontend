// Sprint 8 — Watchliste hartija od vrednosti.
//
// Covers the client-facing watchlist feature end-to-end through the real UI:
//   - WL-FE: create a named watchlist, add a ticker, see it in the table.
//   - WL-BE: duplicate ticker -> 409, unknown ticker -> 400 (surfaced as
//     inline errors), remove a ticker, delete a whole list.
//   - Cross-page: add a security to a list from the security-details page.
//
// A trading-enabled client is provisioned via the admin API; the watchlist
// behaviour itself is driven through the browser so the recording shows the
// real client portal. DB assertions confirm the persisted side-effects.

import {
  adminLogin,
  createClient,
  activateClient,
  loginClientUi,
} from '../helpers/banking'
import { grantClientTrading } from '../helpers/otc'
import { lookupListingId } from '../helpers/orders'

const TICKER = 'AAPL'

function fetchWatchlistTickers(clientId) {
  return cy
    .task('dbExec', {
      sql: `SELECT wi.ticker AS ticker
            FROM watchlist_items wi
            JOIN watchlists w ON w.id = wi.watchlist_id
            WHERE w.user_id = $1 AND w.user_type = 'client'`,
      params: [Number(clientId)],
    })
    .then(({ rows }) => rows.map((r) => r.ticker))
}

describe('Sprint 8 — Watchliste hartija', () => {
  beforeEach(function () {
    this.ctx = {}
    adminLogin()
      .then((token) => {
        this.ctx.adminToken = token
        // Ensure the ticker we rely on really exists on the seeded exchange.
        return lookupListingId(TICKER)
      })
      .then((assetId) => {
        this.ctx.assetId = assetId
        return createClient(this.ctx.adminToken, 's8-watchlist')
      })
      .then((client) => {
        this.ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => grantClientTrading(this.ctx.adminToken, this.ctx.client.id))
      .then(() => {
        loginClientUi(this.ctx.client.email)
      })
  })

  it('Klijent kreira listu, dodaje hartiju i vidi je u tabeli', function () {
    const ctx = this.ctx

    cy.visit('/client/watchlist')
    cy.contains('h1', 'Moje watchliste').should('be.visible')

    // Create a watchlist.
    cy.contains('button', '+ Nova lista').click()
    cy.get('input[placeholder="Naziv liste"]').type('Tehnologija')
    cy.contains('button', 'Kreiraj').click()

    // The new list shows up as an active tab.
    cy.contains('.wl-tab', 'Tehnologija').should('have.class', 'active')

    // Add a ticker.
    cy.get('input[placeholder="Ticker (npr. AAPL)"]').type(TICKER)
    cy.contains('button', 'Dodaj').click()

    // Row appears in the items table.
    cy.contains('.items-table tr', TICKER).within(() => {
      cy.get('.ticker-cell').should('contain', TICKER)
      cy.contains('button', 'Kupi').should('be.visible')
      cy.contains('button', 'Ukloni').should('be.visible')
    })

    // Persisted in the DB.
    cy.then(() => fetchWatchlistTickers(ctx.client.id)).then((tickers) => {
      expect(tickers, 'ticker persisted on the watchlist').to.include(TICKER)
    })
  })

  it('Duplikat i nepostojeci ticker daju greske; uklanjanje hartije prazni listu', function () {
    cy.visit('/client/watchlist')

    cy.contains('button', '+ Nova lista').click()
    cy.get('input[placeholder="Naziv liste"]').type('Lista A')
    cy.contains('button', 'Kreiraj').click()
    cy.contains('.wl-tab', 'Lista A').should('have.class', 'active')

    const addTicker = (value) => {
      cy.get('input[placeholder="Ticker (npr. AAPL)"]').clear().type(value)
      cy.contains('button', 'Dodaj').click()
    }

    // First add succeeds.
    addTicker(TICKER)
    cy.contains('.items-table tr', TICKER).should('be.visible')

    // Duplicate -> inline 409 error.
    addTicker(TICKER)
    cy.contains('.error-msg', `${TICKER} je već na ovoj listi.`).should('be.visible')

    // Unknown ticker -> inline 400 error.
    addTicker('ZZINVALID')
    cy.contains('.error-msg', 'ne postoji na berzi').should('be.visible')

    // Remove the ticker -> list becomes empty.
    cy.contains('.items-table tr', TICKER).within(() => {
      cy.contains('button', 'Ukloni').click()
    })
    cy.contains('Lista je prazna').should('be.visible')
  })

  it('Brisanje liste uklanja je iz tabova', function () {
    cy.visit('/client/watchlist')

    cy.contains('button', '+ Nova lista').click()
    cy.get('input[placeholder="Naziv liste"]').type('Za brisanje')
    cy.contains('button', 'Kreiraj').click()
    cy.contains('.wl-tab', 'Za brisanje').should('be.visible')

    // confirm() defaults to accepted in Cypress.
    cy.contains('button', 'Obriši listu').click()

    cy.contains('.wl-tab', 'Za brisanje').should('not.exist')
  })

  it('Hartija se moze dodati na listu sa stranice detalja', function () {
    const ctx = this.ctx

    // Create an (empty) target list first.
    cy.visit('/client/watchlist')
    cy.contains('button', '+ Nova lista').click()
    cy.get('input[placeholder="Naziv liste"]').type('Iz detalja')
    cy.contains('button', 'Kreiraj').click()
    cy.contains('.wl-tab', 'Iz detalja').should('be.visible')

    // Add from the security-details page via the "Na watchlist" menu.
    cy.visit(`/client/securities/${TICKER}`)
    cy.contains('.ticker-pill', TICKER).should('be.visible')
    cy.contains('button', 'Na watchlist').click()
    cy.contains('.wl-menu-item', 'Iz detalja').click()
    cy.contains('.wl-add-msg', 'Dodato na "Iz detalja"').should('be.visible')

    // Verify it shows on the watchlist page and is persisted.
    cy.visit('/client/watchlist')
    cy.contains('.wl-tab', 'Iz detalja').click()
    cy.contains('.items-table tr', TICKER).should('be.visible')

    cy.then(() => fetchWatchlistTickers(ctx.client.id)).then((tickers) => {
      expect(tickers).to.include(TICKER)
    })
  })
})
