// Celina 4 — Istorija pregovora (OTC negotiation history) + Statistika fondova.
//
// Two lightweight end-to-end checks for the Celina 4 backlog:
//
//   1) Istorija pregovora: a finished (declined) OTC offer with a full
//      negotiation log — initial offer → counter-offer → decline — is seeded,
//      then the buyer opens "/client/otc/negotiations", sees the offer, expands
//      it, and the timeline renders each step with the old→new term changes
//      ("bilo 170.00") that §Celina 4 requires.
//
//   2) Statistika fondova: the funds discovery page exposes the four risk/return
//      metrics from §Celina 4 (godišnji prinos, prinos/rizik, max drawdown,
//      volatilnost) as sort options, proving the statistics feature is wired in.
//
// As with the other trading specs, OTC rows are seeded directly via dbExec
// (placing real offers is too brittle) while assertions drive the real UI.

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

function futureDateString(daysAhead) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

function seedOffer({ ctx, settlement }) {
  const sql = `
    INSERT INTO otc_offers
      (stock_listing_id, seller_holding_id, amount, price_per_stock,
       settlement_date, premium, last_modified, modified_by_id, modified_by_type,
       status, buyer_id, buyer_type, buyer_account_id,
       seller_id, seller_type, seller_account_id, created_at, updated_at)
    VALUES
      ($1, $2, 2, 180, $3::date, 50, NOW(), $4, 'client',
       'declined', $4, 'client', $5, $6, 'client', $7, NOW(), NOW())
    RETURNING id
  `
  return cy
    .task('dbExec', {
      sql,
      params: [
        ctx.assetId,
        ctx.sellerHoldingId,
        settlement,
        Number(ctx.buyer.id),
        Number(ctx.buyerAccount.id),
        Number(ctx.seller.id),
        Number(ctx.sellerAccount.id),
      ],
    })
    .then(({ rows }) => {
      expect(rows[0]?.id, 'seeded otc offer id').to.exist
      return Number(rows[0].id)
    })
}

// Append the three negotiation steps: created (buyer), countered (seller,
// carrying the prev terms), declined (buyer). created_at is staggered so the
// timeline orders deterministically.
function seedNegotiationLog({ offerId, ctx, settlement }) {
  const sql = `
    INSERT INTO otc_negotiation_entries
      (offer_id, action, actor_id, actor_type, amount, price_per_stock, premium,
       settlement_date, prev_amount, prev_price_per_stock, prev_premium,
       prev_settlement_date, created_at)
    VALUES
      ($1, 'created',  $2, 'client', 2, 170, 40, $4::date, NULL, NULL, NULL, NULL, NOW() - interval '2 hours'),
      ($1, 'countered',$3, 'client', 2, 180, 50, $4::date, 2,   170,  40,   $4::date, NOW() - interval '1 hour'),
      ($1, 'declined', $2, 'client', 2, 180, 50, $4::date, NULL, NULL, NULL, NULL, NOW())
  `
  return cy.task('dbExec', {
    sql,
    params: [offerId, Number(ctx.buyer.id), Number(ctx.seller.id), settlement],
  })
}

describe('Celina 4 — Istorija pregovora + Statistika fondova', () => {
  beforeEach(function () {
    this.ctx = {}
    const ctx = this.ctx
    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return fetchCurrencies(token)
      })
      .then((currencies) => {
        const usd = currencies.find((c) => c.kod === 'USD')
        expect(usd, 'USD currency seeded').to.exist
        ctx.usdId = usd.id
        return lookupListingId(TICKER)
      })
      .then((assetId) => {
        ctx.assetId = assetId
        return createClient(ctx.adminToken, 'c4-seller')
      })
      .then((seller) => {
        ctx.seller = seller
        return activateClient(seller.setupToken)
      })
      .then(() => grantClientTrading(ctx.adminToken, ctx.seller.id))
      .then(() =>
        createAccount(ctx.adminToken, ctx.seller.id, ctx.usdId, `CYP-NEG-SELL-${Date.now()}`, 1000, {
          tip: 'devizni',
        })
      )
      .then((account) => {
        ctx.sellerAccount = account
        return createClient(ctx.adminToken, 'c4-buyer')
      })
      .then((buyer) => {
        ctx.buyer = buyer
        return activateClient(buyer.setupToken)
      })
      .then(() => grantClientTrading(ctx.adminToken, ctx.buyer.id))
      .then(() =>
        createAccount(ctx.adminToken, ctx.buyer.id, ctx.usdId, `CYP-NEG-BUY-${Date.now()}`, 5000, {
          tip: 'devizni',
        })
      )
      .then((account) => {
        ctx.buyerAccount = account
        return seedPublicHolding({
          userId: Number(ctx.seller.id),
          userType: 'client',
          assetId: ctx.assetId,
          accountId: Number(ctx.sellerAccount.id),
          quantity: 5,
          publicQuantity: 5,
          avgBuyPrice: 150,
        })
      })
      .then(({ holdingId }) => {
        ctx.sellerHoldingId = holdingId
      })
  })

  it('Kupac vidi istoriju pregovora sa timeline-om kontraponuda', function () {
    const ctx = this.ctx
    const settlement = futureDateString(30)

    seedOffer({ ctx, settlement })
      .then((offerId) => {
        ctx.offerId = offerId
        return seedNegotiationLog({ offerId, ctx, settlement })
      })
      .then(() => {
        loginClientUi(ctx.buyer.email)
        cy.visit('/client/otc/negotiations')
        cy.contains('h1', 'Istorija pregovora').should('be.visible')

        // The declined offer shows up with the buyer's role and ticker.
        cy.contains('.otc-table tr', `#${ctx.offerId}`).within(() => {
          cy.contains('Kupac').should('be.visible')
          cy.get('.ticker').should('contain', TICKER)
          cy.contains('.status-pill', 'Odbijena').should('be.visible')
        })

        // Expand the row -> the negotiation timeline.
        cy.contains('.otc-table tr', `#${ctx.offerId}`).click()
        cy.get('.history-row .timeline').within(() => {
          cy.contains('.timeline-action', 'Inicijalna ponuda').should('be.visible')
          cy.contains('.timeline-action', 'Kontraponuda').should('be.visible')
          cy.contains('.timeline-action', 'Odbijeno').should('be.visible')
          // The counter-offer records the prior price (170 -> 180).
          cy.contains('bilo 170.00').should('be.visible')
        })
      })

    // Persisted: three negotiation entries for this offer.
    cy.then(() =>
      cy.task('dbExec', {
        sql: 'SELECT count(*)::int AS n FROM otc_negotiation_entries WHERE offer_id = $1',
        params: [ctx.offerId],
      })
    ).then(({ rows }) => {
      expect(rows[0].n).to.eq(3)
    })
  })

  it('Stranica fondova nudi sortiranje po statistici (prinos, rizik, drawdown, volatilnost)', function () {
    loginClientUi(this.ctx.buyer.email)
    cy.visit('/client/funds')
    cy.contains('h1', 'Investicioni fondovi').should('be.visible')

    // The four §Celina 4 risk/return metrics are exposed as sort options.
    cy.get('.filters select').within(() => {
      cy.contains('option', 'godišnji prinos').should('exist')
      cy.contains('option', 'prinos/rizik').should('exist')
      cy.contains('option', 'max drawdown').should('exist')
      cy.contains('option', 'volatilnost').should('exist')
    })

    // If any funds are seeded, the metric column headers render too.
    cy.get('body').then(($body) => {
      if ($body.find('.data-table').length) {
        cy.get('.data-table thead').within(() => {
          cy.contains('th', 'God. prinos').should('exist')
          cy.contains('th', 'Prinos/rizik').should('exist')
          cy.contains('th', 'Max drawdown').should('exist')
          cy.contains('th', 'Volatilnost').should('exist')
        })
      }
    })
  })
})
