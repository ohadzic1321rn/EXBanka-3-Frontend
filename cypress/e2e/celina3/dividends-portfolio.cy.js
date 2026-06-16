// Celina 3 — Isplata dividendi (dividend payout).
//
// A lightweight end-to-end check that the quarterly dividend feature surfaces
// in the client portal:
//   - A DividendPayout row (the exact record the payout cron writes) is seeded
//     for a trading client that holds AAPL.
//   - The client opens "Moj Portfolio" and the "Isplaćene dividende" panel
//     renders the payout with period, gross, credited amount and the 15%
//     capital-gains tax (RSD) — exactly the columns from §Celina 3.
//
// The holding + payout are seeded directly via dbExec (same approach as the
// OTC/watchlist specs) so the recording shows the real portfolio page reading
// the persisted dividend through the live API.

import '../helpers/slowdown'
import {
  adminLogin,
  createClient,
  activateClient,
  createAccount,
  fetchCurrencies,
  loginClientUi,
} from '../helpers/banking'
import { grantClientTrading, seedPublicHolding } from '../helpers/otc'
import { lookupListingId } from '../helpers/orders'

const TICKER = 'AAPL'
const QUANTITY = 10
const PRICE_PER_SHARE = 180
const DIVIDEND_YIELD = 0.04 // 4% annual -> /4 per quarter
const GROSS = PRICE_PER_SHARE * QUANTITY * (DIVIDEND_YIELD / 4) // = 18 USD
const TAX_RSD = 31.5 // 15% of gross, converted to RSD (illustrative)
const PERIOD = '2026-Q2'

function seedDividendPayout({ assetId, userId, accountId }) {
  const sql = `
    INSERT INTO dividend_payouts
      (asset_id, ticker, user_id, user_type, account_id, quantity,
       price_per_share, dividend_yield, currency, gross_amount,
       credited_amount, credited_currency, tax_rsd, period, paid_at, created_at)
    VALUES
      ($1, $2, $3, 'client', $4, $5, $6, $7, 'USD', $8, $8, 'USD', $9, $10, NOW(), NOW())
    RETURNING id
  `
  return cy
    .task('dbExec', {
      sql,
      params: [
        assetId, TICKER, userId, accountId, QUANTITY,
        PRICE_PER_SHARE, DIVIDEND_YIELD, GROSS, TAX_RSD, PERIOD,
      ],
    })
    .then(({ rows }) => {
      expect(rows[0]?.id, 'seeded dividend payout id').to.exist
      return Number(rows[0].id)
    })
}

function fetchPayouts(userId) {
  return cy
    .task('dbExec', {
      sql: `SELECT ticker, period, gross_amount::float AS gross
            FROM dividend_payouts
            WHERE user_id = $1 AND user_type = 'client'`,
      params: [Number(userId)],
    })
    .then(({ rows }) => rows)
}

describe('Celina 3 — Isplata dividendi', () => {
  beforeEach(function () {
    this.ctx = {}
    adminLogin()
      .then((token) => {
        this.ctx.adminToken = token
        return fetchCurrencies(token)
      })
      .then((currencies) => {
        const usd = currencies.find((c) => c.kod === 'USD')
        expect(usd, 'USD currency seeded').to.exist
        this.ctx.usdId = usd.id
        return lookupListingId(TICKER)
      })
      .then((assetId) => {
        this.ctx.assetId = assetId
        return createClient(this.ctx.adminToken, 'c3-dividends')
      })
      .then((client) => {
        this.ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => grantClientTrading(this.ctx.adminToken, this.ctx.client.id))
      .then(() =>
        createAccount(
          this.ctx.adminToken,
          this.ctx.client.id,
          this.ctx.usdId,
          `CYP-DIV-USD-${Date.now()}`,
          1000,
          { tip: 'devizni' }
        )
      )
      .then((account) => {
        this.ctx.account = account
        // The portfolio page only renders its sub-panels (incl. dividends) once
        // the client holds at least one position, so seed the AAPL holding too.
        return seedPublicHolding({
          userId: Number(this.ctx.client.id),
          userType: 'client',
          assetId: this.ctx.assetId,
          accountId: Number(account.id),
          quantity: QUANTITY,
          publicQuantity: 0,
          avgBuyPrice: 150,
        })
      })
      .then(() =>
        seedDividendPayout({
          assetId: this.ctx.assetId,
          userId: Number(this.ctx.client.id),
          accountId: Number(this.ctx.account.id),
        })
      )
      .then(() => loginClientUi(this.ctx.client.email))
  })

  it('Klijent vidi isplaćenu dividendu u portfoliju', function () {
    const ctx = this.ctx

    cy.visit('/client/portfolio')
    cy.contains('h2', 'Isplaćene dividende').should('be.visible')

    // The seeded payout row is rendered with the §Celina 3 columns.
    cy.contains('.dividend-panel tr', TICKER).within(() => {
      cy.contains(PERIOD).should('be.visible')
      cy.get('.ticker').should('contain', TICKER)
      // Gross 18.00 USD credited as 18.00 USD; 4.00% yield; tax in RSD.
      cy.contains('18.00').should('exist')
      cy.contains('4.00%').should('be.visible')
      cy.contains(TAX_RSD.toFixed(2)).should('be.visible')
    })

    // Persisted exactly once for this client.
    cy.then(() => fetchPayouts(ctx.client.id)).then((rows) => {
      expect(rows).to.have.length(1)
      expect(rows[0].ticker).to.eq(TICKER)
      expect(rows[0].period).to.eq(PERIOD)
      expect(Number(rows[0].gross)).to.be.closeTo(GROSS, 0.01)
    })
  })
})
