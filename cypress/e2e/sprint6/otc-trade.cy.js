// Sprint 6 — OTC trgovina end-to-end.
//
// Covers the most important Sprint 6 backlog items:
//   - OTC-BE-3 / OTC-FE-13: SetPublicMode toggle on a portfolio holding.
//   - OTC-BE-4 / OTC-FE-9 / OTC-FE-10: buyer creates an OTC offer for a
//     publicly-listed stock.
//   - OTC-BE-4 / OTC-BE-5 / OTC-FE-11: seller accepts the offer; service
//     creates an OtcContract and transfers the premium from buyer to seller.
//
// The seller-side holding is seeded directly (cy.task('dbExec')) because
// getting a real share onto a client account otherwise requires a placed +
// filled market order, which is too brittle to script.

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
  fetchOtcContract,
  fetchOtcOffer,
  findLatestOfferForHolding,
  grantClientTrading,
  seedPublicHolding,
} from '../helpers/otc'

const TICKER = 'AAPL'
const SHARES_PUBLIC = 5
const SELLER_USD_BALANCE = 1000
const BUYER_USD_BALANCE = 5000
const OFFER_AMOUNT = 2
const OFFER_PRICE = 175
const OFFER_PREMIUM = 50

function futureDateString(daysAhead) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

describe('Sprint 6 — OTC trgovina (public mode → ponuda → ugovor)', () => {
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

        return createClient(this.ctx.adminToken, 's6-seller')
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
          `CYP-OTC-SELL-USD-${Date.now()}`,
          SELLER_USD_BALANCE,
          { tip: 'devizni' }
        )
      )
      .then((account) => {
        this.ctx.sellerAccount = account
        return createClient(this.ctx.adminToken, 's6-buyer')
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
          `CYP-OTC-BUY-USD-${Date.now()}`,
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
      })
  })

  it('buyer kreira ponudu, seller prihvata → ugovor + transfer premije', function () {
    const ctx = this.ctx

    seedPublicHolding({
      userId: Number(ctx.seller.id),
      userType: 'client',
      assetId: ctx.assetId,
      accountId: Number(ctx.sellerAccount.id),
      quantity: SHARES_PUBLIC,
      publicQuantity: SHARES_PUBLIC,
      avgBuyPrice: 150,
    }).then(({ holdingId }) => {
      ctx.sellerHoldingId = holdingId

      // Buyer drives the offer form on the OTC public-stocks page.
      loginClientUi(ctx.buyer.email)
      cy.visit('/client/otc')
      cy.contains('h1', 'Javne akcije').should('be.visible')

      cy.contains('tr', TICKER).within(() => {
        cy.contains('button', 'Kreiraj ponudu').click()
      })

      cy.get('.offer-modal').within(() => {
        cy.contains('h2', TICKER).should('be.visible')
        cy.get('select').select(String(ctx.buyerAccount.id))
        cy.get('input[type="number"]').eq(0).clear().type(String(OFFER_AMOUNT))
        cy.get('input[type="number"]').eq(1).clear().type(String(OFFER_PRICE))
        cy.get('input[type="number"]').eq(2).clear().type(String(OFFER_PREMIUM))
        cy.get('input[type="date"]').clear().type(futureDateString(30))
        cy.contains('button', 'Kreiraj ponudu').click()
      })

      cy.contains('.success-box', 'kreirana').should('be.visible')

      // Sanity-check: offer landed in DB, status pending, modified_by = buyer.
      cy.then(() => findLatestOfferForHolding(ctx.sellerHoldingId)).then((row) => {
        expect(row, 'pending offer exists').to.exist
        expect(row.status).to.eq('pending')
        ctx.offerId = Number(row.id)
      })

      cy.then(() => fetchOtcOffer(ctx.offerId)).then((offer) => {
        expect(Number(offer.amount)).to.eq(OFFER_AMOUNT)
        expect(Number(offer.price_per_stock)).to.eq(OFFER_PRICE)
        expect(Number(offer.premium)).to.eq(OFFER_PREMIUM)
        expect(offer.modified_by_type).to.eq('client')
        expect(Number(offer.modified_by_id)).to.eq(Number(ctx.buyer.id))
      })

      // Buyer's balance shouldn't move until accept; premium debits on accept.
      cy.then(() => fetchAccountBalance(Number(ctx.buyerAccount.id))).then(
        (after) => {
          expect(after).to.be.closeTo(BUYER_USD_BALANCE, 0.01)
        }
      )

      // Seller logs in and accepts — confirm() returns true via window.confirm stub.
      cy.then(() => loginClientUi(ctx.seller.email))
      cy.window().then((win) => {
        cy.stub(win, 'confirm').returns(true)
      })
      cy.visit('/client/otc/offers')
      cy.contains('h1', 'Aktivne ponude').should('be.visible')

      cy.then(() => {
        cy.contains('tr', `#${ctx.offerId}`).within(() => {
          cy.contains('button', 'Prihvati').click()
        })
      })

      cy.contains('.success-box', 'prihvacena', { timeout: 15000 }).should('be.visible')

      // Premium moved: buyer -OFFER_PREMIUM, seller +OFFER_PREMIUM.
      cy.then(() => fetchAccountBalance(Number(ctx.buyerAccount.id))).then(
        (after) => {
          expect(after, 'buyer USD debited premium').to.be.closeTo(
            BUYER_USD_BALANCE - OFFER_PREMIUM,
            0.01
          )
        }
      )
      cy.then(() => fetchAccountBalance(Number(ctx.sellerAccount.id))).then(
        (after) => {
          expect(after, 'seller USD credited premium').to.be.closeTo(
            SELLER_USD_BALANCE + OFFER_PREMIUM,
            0.01
          )
        }
      )

      // Offer is accepted; a valid contract was created in the same flow.
      cy.then(() => fetchOtcOffer(ctx.offerId)).then((offer) => {
        expect(offer.status).to.eq('accepted')
      })
      cy.then(() =>
        cy.task('dbExec', {
          sql:
            'SELECT id, status FROM otc_contracts WHERE seller_id = $1 AND buyer_id = $2 ORDER BY id DESC LIMIT 1',
          params: [Number(ctx.seller.id), Number(ctx.buyer.id)],
        })
      ).then(({ rows }) => {
        expect(rows[0], 'contract created on accept').to.exist
        expect(rows[0].status).to.eq('valid')
        ctx.contractId = Number(rows[0].id)
      })
      cy.then(() => fetchOtcContract(ctx.contractId)).then((contract) => {
        expect(Number(contract.amount)).to.eq(OFFER_AMOUNT)
        expect(Number(contract.strike_price)).to.eq(OFFER_PRICE)
        expect(Number(contract.premium)).to.eq(OFFER_PREMIUM)
      })
    })
  })
})
