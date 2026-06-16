// Celina 3 — Notifikacije o orderima + Istorija ordera ("Moji orderi").
//
// Two end-to-end checks for the order-lifecycle features of §Celina 3:
//   1) Placing an order emits an in-app + email notification to the client
//      ("Kada agent/klijent kreira order"). We place a real market buy via the
//      live order API, wait for the ORDER_CREATED notification to propagate
//      through notification-service, then open the bell and confirm the email
//      landed in MailHog.
//   2) The order shows up in the client's own order history ("Istorija kupovina
//      akcija" on the portfolio page) — clients can now see their past orders.
//
// The client + USD account are provisioned via the admin API; the order is
// placed with the client's own JWT (read from sessionStorage after UI login).

import '../helpers/slowdown'
import {
  adminLogin,
  createClient,
  activateClient,
  createAccount,
  fetchCurrencies,
  loginClientUi,
  API_BASE,
} from '../helpers/banking'
import { grantClientTrading, seedPublicHolding } from '../helpers/otc'
import { createOrder, lookupListingId } from '../helpers/orders'

const TICKER = 'AAPL'

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

// Read the client's access token straight from the session it logged in with.
function clientToken() {
  return cy.window().then((win) => win.sessionStorage.getItem('client_access_token'))
}

// Poll notification-service until the ORDER_CREATED notification has propagated.
function waitForOrderNotification(token, attempt = 0) {
  return cy
    .request({ method: 'GET', url: `${API_BASE}/notifications`, headers: authHeader(token) })
    .then(({ body }) => {
      const list = Array.isArray(body) ? body : body.notifications || []
      const hit = list.find((n) => n.type === 'ORDER_CREATED')
      if (hit) return hit
      if (attempt >= 15) throw new Error('ORDER_CREATED notification never arrived')
      cy.wait(1000)
      return waitForOrderNotification(token, attempt + 1)
    })
}

// Poll MailHog for the order-created email addressed to the client.
function waitForOrderEmail(email, attempt = 0) {
  return cy.request('GET', 'http://localhost:8025/api/v2/messages').then(({ body }) => {
    const match = (body.items || []).find((item) => {
      const to = (item.Content?.Headers?.To || []).join(' ')
      const text = item.Content?.Body || ''
      return to.includes(email) && text.toLowerCase().includes('order')
    })
    if (match) return match
    if (attempt >= 12) throw new Error(`order email never arrived for ${email}`)
    cy.wait(1000)
    return waitForOrderEmail(email, attempt + 1)
  })
}

describe('Celina 3 — Notifikacije + istorija ordera', () => {
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
        return createClient(ctx.adminToken, 'c3-orders')
      })
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => grantClientTrading(ctx.adminToken, ctx.client.id))
      .then(() =>
        createAccount(ctx.adminToken, ctx.client.id, ctx.usdId, `CYP-ORD-USD-${Date.now()}`, 5000, {
          tip: 'devizni',
        })
      )
      .then((account) => {
        ctx.account = account
        loginClientUi(ctx.client.email)
        return clientToken()
      })
      .then((token) => {
        ctx.token = token
      })
  })

  it('Klijent dobija in-app i email obaveštenje kada kreira order', function () {
    const ctx = this.ctx

    createOrder(ctx.token, {
      assetTicker: TICKER,
      orderType: 'market',
      direction: 'buy',
      quantity: 1,
      accountId: Number(ctx.account.id),
    }).then(({ status, body }) => {
      expect(status, `order created (${JSON.stringify(body)})`).to.eq(201)
    })

    // The ORDER_CREATED notification propagates through notification-service.
    waitForOrderNotification(ctx.token)

    // The bell surfaces it in-app.
    cy.visit('/client/dashboard')
    cy.get('.notif-trigger').click()
    cy.get('.notif-dropdown').within(() => {
      cy.contains('.notif-item-title', 'Order kreiran').should('be.visible')
      cy.contains('.notif-item-body', TICKER).should('be.visible')
    })

    // And the same notification was emailed to the client.
    cy.then(() => waitForOrderEmail(ctx.client.email)).then((mail) => {
      expect(mail, 'order email in MailHog').to.exist
    })
  })

  it('Order se vidi u istoriji kupovina na portfoliju', function () {
    const ctx = this.ctx

    // A holding makes the portfolio render its panels; the placed order then
    // shows up in the buy-order history list.
    seedPublicHolding({
      userId: Number(ctx.client.id),
      userType: 'client',
      assetId: ctx.assetId,
      accountId: Number(ctx.account.id),
      quantity: 5,
      publicQuantity: 0,
      avgBuyPrice: 150,
    })

    createOrder(ctx.token, {
      assetTicker: TICKER,
      orderType: 'market',
      direction: 'buy',
      quantity: 1,
      accountId: Number(ctx.account.id),
    }).then(({ status }) => {
      expect(status).to.eq(201)
    })

    cy.visit('/client/portfolio')
    cy.contains('h2', 'Istorija kupovina akcija').should('be.visible')
    cy.get('.buy-history-panel').within(() => {
      cy.contains(TICKER).should('be.visible')
    })
  })
})
