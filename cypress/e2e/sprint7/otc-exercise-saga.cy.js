// Sprint 7 — Iskoriscavanje OTC opcije pokrece SAGA orkestrator.
//
// Covers:
//   - SAGA-BE-1 .. SAGA-BE-6: 5-step orchestrator with consistency check.
//   - OTC-BE-9 / OTC-BE-10: ExerciseContract endpoint + saga status endpoint.
//   - OTC-FE-14: "Iskoristi" button + SAGA progress visualised in the modal.
//
// Buyer + seller + valid OTC contract are seeded directly; only the "Iskoristi"
// flow (modal -> saga progress -> contract.status = exercised) is driven
// through the UI so the recorded video shows the real client portal.

import {
  adminLogin,
  activateClient,
  createAccount,
  createClient,
  fetchCurrencies,
  loginClientUi,
} from '../helpers/banking'
import { lookupListingId } from '../helpers/orders'
import {
  fetchAccountBalance,
  fetchHoldingQuantities,
  fetchOtcContract,
  grantClientTrading,
  seedOtcContract,
  seedPublicHolding,
} from '../helpers/otc'

const TICKER = 'AAPL'
const AMOUNT = 1
const STRIKE_PRICE = 100
const PREMIUM = 20
const SELLER_USD_BALANCE = 500
const BUYER_USD_BALANCE = 2000

describe('Sprint 7 — Exercise OTC ugovora preko SAGA orkestratora', () => {
  beforeEach(function () {
    this.ctx = {}
    adminLogin()
      .then((admin) => {
        this.ctx.adminToken = admin
        return fetchCurrencies(admin)
      })
      .then((currencies) => {
        const usd = currencies.find((c) => c.kod === 'USD')
        expect(usd, 'USD currency seeded').to.exist
        this.ctx.usdId = usd.id
        return createClient(this.ctx.adminToken, 's7-seller')
      })
      .then((seller) => {
        this.ctx.seller = seller
        return activateClient(seller.setupToken)
      })
      .then(() => grantClientTrading(this.ctx.adminToken, this.ctx.seller.id))
      .then(() =>
        createAccount(
          this.ctx.adminToken,
          this.ctx.seller.id,
          this.ctx.usdId,
          `CYP-OTC-EX-SELL-${Date.now()}`,
          SELLER_USD_BALANCE,
          { tip: 'devizni' }
        )
      )
      .then((account) => {
        this.ctx.sellerAccount = account
        return createClient(this.ctx.adminToken, 's7-buyer')
      })
      .then((buyer) => {
        this.ctx.buyer = buyer
        return activateClient(buyer.setupToken)
      })
      .then(() => grantClientTrading(this.ctx.adminToken, this.ctx.buyer.id))
      .then(() =>
        createAccount(
          this.ctx.adminToken,
          this.ctx.buyer.id,
          this.ctx.usdId,
          `CYP-OTC-EX-BUY-${Date.now()}`,
          BUYER_USD_BALANCE,
          { tip: 'devizni' }
        )
      )
      .then((account) => {
        this.ctx.buyerAccount = account
        return lookupListingId(TICKER)
      })
      .then((assetId) => {
        this.ctx.assetId = assetId

        // Seller already has AMOUNT shares reserved against this contract.
        return seedPublicHolding({
          userId: Number(this.ctx.seller.id),
          userType: 'client',
          assetId,
          accountId: Number(this.ctx.sellerAccount.id),
          quantity: AMOUNT,
          publicQuantity: AMOUNT,
          reservedQuantity: AMOUNT,
          avgBuyPrice: 80,
        })
      })
      .then(({ holdingId }) => {
        this.ctx.sellerHoldingId = holdingId

        return seedOtcContract({
          stockListingId: this.ctx.assetId,
          sellerHoldingId: holdingId,
          amount: AMOUNT,
          strikePrice: STRIKE_PRICE,
          premium: PREMIUM,
          buyerId: Number(this.ctx.buyer.id),
          buyerType: 'client',
          buyerAccountId: Number(this.ctx.buyerAccount.id),
          sellerId: Number(this.ctx.seller.id),
          sellerType: 'client',
          sellerAccountId: Number(this.ctx.sellerAccount.id),
        })
      })
      .then(({ contractId }) => {
        this.ctx.contractId = contractId
      })
  })

  it('Buyer pokrece SAGA, ugovor postaje exercised, sredstva i hartije se prebacuju', function () {
    const ctx = this.ctx

    loginClientUi(ctx.buyer.email)
    cy.visit('/client/otc/contracts')
    cy.contains('h1', 'Sklopljeni ugovori').should('be.visible')

    cy.contains('tr', `#${ctx.contractId}`).within(() => {
      cy.contains('button', 'Iskoristi').click()
    })

    cy.get('.exercise-modal').within(() => {
      cy.contains('h2', `#${ctx.contractId}`).should('be.visible')
      cy.contains('button', 'Pokreni iskoriscavanje').click()
    })

    // SAGA orchestrator runs all 5 steps synchronously within the HTTP request;
    // the modal then polls /saga/{id} and prints status "SAGA uspesno zavrsena".
    cy.contains('.saga-overall', 'SAGA uspesno zavrsena', { timeout: 30000 })
      .should('be.visible')
    cy.contains('.saga-step', '1. Rezervacija sredstava kupca').should('contain', 'Zavrseno')
    cy.contains('.saga-step', '5. Finalna provera').should('contain', 'Zavrseno')

    // Persisted side-effects.
    cy.then(() => fetchOtcContract(ctx.contractId)).then((contract) => {
      expect(contract.status, 'contract marked exercised').to.eq('exercised')
      expect(Number(contract.exercised_at_price), 'exercise snapshot price set').to.be.greaterThan(0)
    })

    cy.then(() => fetchAccountBalance(Number(ctx.buyerAccount.id))).then((after) => {
      expect(after, 'buyer USD debited strike * amount').to.be.closeTo(
        BUYER_USD_BALANCE - STRIKE_PRICE * AMOUNT,
        0.01
      )
    })
    cy.then(() => fetchAccountBalance(Number(ctx.sellerAccount.id))).then((after) => {
      expect(after, 'seller USD credited strike * amount').to.be.closeTo(
        SELLER_USD_BALANCE + STRIKE_PRICE * AMOUNT,
        0.01
      )
    })

    // Seller's reserved shares released, holding quantity reduced to 0.
    cy.then(() => fetchHoldingQuantities(ctx.sellerHoldingId)).then((q) => {
      expect(q.quantity, 'seller holding drained').to.be.lessThan(AMOUNT)
    })

    // Buyer now owns the underlying.
    cy.then(() =>
      cy.task('dbExec', {
        sql:
          'SELECT SUM(quantity)::float AS qty FROM portfolio_holdings WHERE user_id = $1 AND user_type = $2 AND asset_id = $3',
        params: [Number(ctx.buyer.id), 'client', ctx.assetId],
      })
    ).then(({ rows }) => {
      const qty = Number(rows[0]?.qty ?? 0)
      expect(qty, 'buyer received the underlying shares').to.be.gte(AMOUNT)
    })
  })
})
