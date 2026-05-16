// PORTFOLIO-FE-5 — Client portfolio page renders P/L, sell modal, and empty state.

import {
  adminLogin,
  createClient,
  activateClient,
  updateClientPermissions,
  loginClientUi,
  fetchCurrencies,
  createAccount,
} from '../helpers/banking'
import { lookupListingId } from '../helpers/orders'

const TICKER = 'AAPL'

function seedHoldingForClient({ userId, accountId, assetId, quantity, avgBuyPrice }) {
  return cy.task('dbExec', {
    sql: `
      INSERT INTO portfolio_holdings
        (user_id, user_type, asset_id, asset_type, quantity, avg_buy_price,
         reserved_quantity, public_quantity, is_public, realized_profit,
         account_id, created_at, updated_at)
      VALUES ($1, 'client', $2, 'stock', $3, $4, 0, 0, FALSE, 0, $5, NOW(), NOW())
      RETURNING id
    `,
    params: [userId, assetId, quantity, avgBuyPrice, accountId],
  })
}

function fetchListingPrice(ticker) {
  return cy
    .task('dbExec', {
      sql: 'SELECT price FROM market_listings WHERE ticker = $1 LIMIT 1',
      params: [ticker],
    })
    .then(({ rows }) => {
      expect(rows[0], `market_listings row for ${ticker}`).to.exist
      return Number(rows[0].price)
    })
}

function setupClientWithHolding(label, quantity, avgBuyPrice) {
  const ctx = {}
  return adminLogin()
    .then((token) => {
      ctx.adminToken = token
      return fetchCurrencies(token)
    })
    .then((currencies) => {
      ctx.usdId = currencies.find((c) => c.kod === 'USD')?.id
      return createClient(ctx.adminToken, label)
    })
    .then((client) => {
      ctx.client = client
      return activateClient(client.setupToken)
    })
    .then(() => updateClientPermissions(ctx.adminToken, ctx.client.id, ['clientBasic', 'clientTrading']))
    .then(() => {
      if (!ctx.usdId) throw new Error('USD currency missing — seed data incomplete')
      return createAccount(ctx.adminToken, ctx.client.id, ctx.usdId, `CYP-USD-${label}`, 5000)
    })
    .then((account) => {
      ctx.accountId = account.id
      return lookupListingId(TICKER)
    })
    .then((listingId) =>
      seedHoldingForClient({
        userId: Number(ctx.client.id),
        accountId: Number(ctx.accountId),
        assetId: listingId,
        quantity,
        avgBuyPrice,
      })
    )
    .then(() => ctx)
}

function parseFormatted(text) {
  // strip thousands separator and any non-numeric trailers (e.g. trailing %)
  return Number(String(text).replace(/,/g, '').replace(/[^\d.\-]/g, ''))
}

describe('PORTFOLIO-FE-5 — Client portfolio page', () => {
  it('shows correct unrealized P/L for a seeded holding', () => {
    const QTY = 10
    const AVG = 100

    setupClientWithHolding('pf-pnl', QTY, AVG).then((ctx) => {
      fetchListingPrice(TICKER).then((listingPrice) => {
        const expectedPnL = (listingPrice - AVG) * QTY

        loginClientUi(ctx.client.email)
        cy.visit('/client/portfolio')

        cy.contains('h1', 'Portfolio').should('be.visible')
        cy.contains('h2', 'Pozicije').should('be.visible')

        cy.contains('tr', TICKER).within(() => {
          // P/L cell is the 8th td (after Ticker, Naziv, Tip, Količina, Avg price,
          // Current price, Market value) and contains the formatted number in
          // either a .positive or .negative div.
          cy.get('td').eq(7).find('div').first().invoke('text').then((text) => {
            const displayed = parseFormatted(text)
            // backend rounds to 2 decimals; allow a small tolerance on top.
            expect(displayed, 'displayed P/L matches formula').to.be.closeTo(expectedPnL, 0.05)
          })
        })
      })
    })
  })

  it('clicking Prodaj opens the sell modal pre-filled with the ticker and max quantity', () => {
    const QTY = 10

    setupClientWithHolding('pf-sell', QTY, 100).then((ctx) => {
      loginClientUi(ctx.client.email)
      cy.visit('/client/portfolio')

      cy.contains('tr', TICKER).within(() => {
        cy.contains('button', 'Prodaj').click()
      })

      cy.get('.modal-box').should('be.visible')
      cy.get('.modal-box').contains('h2', 'Prodaj').should('be.visible')
      cy.get('.modal-box .ticker-pill').should('contain.text', TICKER)
      cy.contains('label', new RegExp(`Količina.*max\\s*${QTY}`)).should('be.visible')
    })
  })

  it('empty portfolio shows the empty-state message', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createClient(token, 'pf-empty')
      })
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => updateClientPermissions(ctx.adminToken, ctx.client.id, ['clientBasic', 'clientTrading']))
      .then(() => {
        loginClientUi(ctx.client.email)
        cy.visit('/client/portfolio')

        cy.contains('h1', 'Portfolio').should('be.visible')
        cy.contains('.empty-state', 'Portfolio trenutno nema aktivnih pozicija').should('be.visible')
      })
  })
})
