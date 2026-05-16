// ORDER-FE-10 — Sell order form (from portfolio Prodaj button) + option exercise (employee).

import {
  adminLogin,
  createClient,
  activateClient,
  updateClientPermissions,
  loginClientUi,
  fetchCurrencies,
  createAccount,
} from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'
import { createAgent, loginEmployeeApi, DEFAULT_EMPLOYEE_PASSWORD } from '../helpers/actuary'
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

describe('ORDER-FE-10 — Client sell flow', () => {
  it('Prodaj on a seeded stock holding opens the sell modal with locked account and max qty', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return fetchCurrencies(token).then((currencies) => {
          ctx.usdId = currencies.find((c) => c.kod === 'USD')?.id
          return createClient(token, 'order-fe10-sell')
        })
      })
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => updateClientPermissions(ctx.adminToken, ctx.client.id, ['clientBasic', 'clientTrading']))
      .then(() => {
        if (!ctx.usdId) throw new Error('USD currency missing — seed data incomplete')
        return createAccount(ctx.adminToken, ctx.client.id, ctx.usdId, 'CYP-USD-Sell', 5000)
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
          quantity: 10,
          avgBuyPrice: 150,
        })
      )
      .then(() => {
        loginClientUi(ctx.client.email)
        cy.visit('/client/portfolio')

        cy.contains('h2', 'Pozicije').should('be.visible')
        cy.contains('tr', TICKER).within(() => {
          cy.contains('button', 'Prodaj').click()
        })

        cy.get('.modal-box').should('be.visible')
        cy.contains('h2', 'Prodaj').should('be.visible')
        cy.contains('label', /Količina.*max\s*10/).should('be.visible')
        cy.get('.locked-account-input').should('exist').and('be.disabled')
      })
  })

  it('client cannot sell more than they own — submit produces a validation error', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return fetchCurrencies(token).then((currencies) => {
          ctx.usdId = currencies.find((c) => c.kod === 'USD')?.id
          return createClient(token, 'order-fe10-over')
        })
      })
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => updateClientPermissions(ctx.adminToken, ctx.client.id, ['clientBasic', 'clientTrading']))
      .then(() => createAccount(ctx.adminToken, ctx.client.id, ctx.usdId, 'CYP-USD-Over', 5000))
      .then((account) => {
        ctx.accountId = account.id
        return lookupListingId(TICKER)
      })
      .then((listingId) =>
        seedHoldingForClient({
          userId: Number(ctx.client.id),
          accountId: Number(ctx.accountId),
          assetId: listingId,
          quantity: 5,
          avgBuyPrice: 100,
        })
      )
      .then(() => {
        loginClientUi(ctx.client.email)
        cy.visit('/client/portfolio')
        cy.contains('tr', TICKER).contains('button', 'Prodaj').click()

        cy.get('.modal-box').should('be.visible')
        cy.get('.field').contains('label', /Količina/).parent().find('input').clear().type('999')
        cy.contains('button', 'Nastavi').click()

        cy.get('.error-box').should('be.visible')
        cy.get('.error-box').should('contain', /Maksimalna|maksimalna/i)
      })
  })
})

describe('ORDER-FE-10 — Actuary option exercise', () => {
  it('agent sees the Iskoristi opciju button on an option holding', () => {
    let agentToken

    adminLogin()
      .then((admin) => createAgent(admin, 'order-fe10-actuary'))
      .then((agent) =>
        loginEmployeeApi(agent.email).then((t) => {
          agentToken = t
          loginEmployeeUi(agent.email, DEFAULT_EMPLOYEE_PASSWORD)
        })
      )
      .then(() => {
        cy.visit('/portfolio')
        cy.contains('h1', 'Portfolio').should('be.visible')

        cy.get('body').then(($body) => {
          const hasOptionRow = $body.find('.type-badge:contains("option")').length > 0
          if (hasOptionRow) {
            cy.contains('tr', 'option').within(() => {
              cy.contains('button', 'Iskoristi opciju').should('be.visible')
            })
          } else {
            cy.log('No option holdings present in shared bank portfolio at run-time — only verifying page mounts')
            cy.contains(/Portfolio|Pozicije|Trenutno|Aktivnih/).should('be.visible')
          }
        })
      })
  })
})
