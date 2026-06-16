// Celina 4 — Raspodela dividendi u fondovima (fund dividend distribution).
//
// When a stock a fund holds pays a dividend, the cash flows into the fund and is
// then either reinvested (auto-buying more shares) or paid out pro-rata to the
// fund's participants. This spec seeds both kinds of FundDividend rows against a
// pre-seeded fund and confirms the fund detail page's "Dividende fonda" section
// renders them with the right policy, reinvested shares and distributed cash.
//
// Seeding directly is intentional: triggering a real fund dividend requires the
// quarterly cron + a fund that actually owns a dividend-paying stock. The
// assertions still drive the real client UI reading the persisted records.

import '../helpers/slowdown'
import {
  adminLogin,
  createClient,
  activateClient,
  loginClientUi,
} from '../helpers/banking'
import { grantClientTrading } from '../helpers/otc'
import { lookupListingId } from '../helpers/orders'

const TICKER = 'AAPL'

// A fund pre-seeded in bankdb (id 1 = "TestFond").
function firstFundId() {
  return cy
    .task('dbExec', { sql: 'SELECT id FROM investment_funds ORDER BY id LIMIT 1', params: [] })
    .then(({ rows }) => {
      expect(rows[0]?.id, 'a seeded fund exists').to.exist
      return Number(rows[0].id)
    })
}

function seedFundDividend({ fundId, assetId, period, policy, grossRSD, reinvestedShares, reinvestedRSD, distributedRSD }) {
  const sql = `
    INSERT INTO fund_dividends
      (fund_id, asset_id, ticker, period, quantity, gross_rsd, policy,
       reinvested_shares, reinvested_rsd, distributed_rsd, paid_at, created_at)
    VALUES
      ($1, $2, $3, $4, 100, $5, $6, $7, $8, $9, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  return cy.task('dbExec', {
    sql,
    params: [fundId, assetId, TICKER, period, grossRSD, policy, reinvestedShares, reinvestedRSD, distributedRSD],
  })
}

function cleanupFundDividends(fundId) {
  return cy.task('dbExec', {
    sql: "DELETE FROM fund_dividends WHERE fund_id = $1 AND ticker = $2 AND period IN ('CYP-Q1','CYP-Q2')",
    params: [fundId, TICKER],
  })
}

describe('Celina 4 — Raspodela dividendi u fondovima', () => {
  beforeEach(function () {
    this.ctx = {}
    const ctx = this.ctx
    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return lookupListingId(TICKER)
      })
      .then((assetId) => {
        ctx.assetId = assetId
        return firstFundId()
      })
      .then((fundId) => {
        ctx.fundId = fundId
        return cleanupFundDividends(fundId) // keep the test idempotent
      })
      .then(() => createClient(ctx.adminToken, 'c4-funddiv'))
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => grantClientTrading(ctx.adminToken, ctx.client.id))
      .then(() => loginClientUi(ctx.client.email))
  })

  afterEach(function () {
    if (this.ctx.fundId) cleanupFundDividends(this.ctx.fundId)
  })

  it('Detalji fonda prikazuju reinvestirane i isplaćene dividende', function () {
    const ctx = this.ctx

    // One reinvested dividend, one paid-out dividend.
    seedFundDividend({
      fundId: ctx.fundId, assetId: ctx.assetId, period: 'CYP-Q1', policy: 'reinvest',
      grossRSD: 5000, reinvestedShares: 20, reinvestedRSD: 5000, distributedRSD: 0,
    })
    seedFundDividend({
      fundId: ctx.fundId, assetId: ctx.assetId, period: 'CYP-Q2', policy: 'payout',
      grossRSD: 6000, reinvestedShares: 0, reinvestedRSD: 0, distributedRSD: 6000,
    })

    cy.visit(`/client/funds/${ctx.fundId}`)
    cy.contains('h2', 'Dividende fonda').should('be.visible')

    // Reinvested row: policy "Reinvestiranje" + the bought shares.
    cy.contains('.data-table tr', 'CYP-Q1').within(() => {
      cy.contains(TICKER).should('be.visible')
      cy.contains('Reinvestiranje').should('be.visible')
      cy.contains('20 kom').should('be.visible')
    })

    // Payout row: policy "Isplata" + distributed RSD.
    cy.contains('.data-table tr', 'CYP-Q2').within(() => {
      cy.contains('Isplata').should('be.visible')
      cy.contains('6000.00').should('be.visible')
    })

    // Persisted both dividend records on the fund.
    cy.then(() =>
      cy.task('dbExec', {
        sql: "SELECT policy FROM fund_dividends WHERE fund_id = $1 AND period IN ('CYP-Q1','CYP-Q2') ORDER BY period",
        params: [ctx.fundId],
      })
    ).then(({ rows }) => {
      expect(rows.map((r) => r.policy)).to.deep.eq(['reinvest', 'payout'])
    })
  })
})
