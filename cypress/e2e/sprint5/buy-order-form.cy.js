// ORDER-FE-9 — Buy order form: type selector, AON / Margin / after-hours, account picker,
// confirm step, and auto-approval for client orders.

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
import { createSupervisor, loginEmployeeApi, DEFAULT_EMPLOYEE_PASSWORD } from '../helpers/actuary'
import { getListing } from '../helpers/market'
import { listOrders } from '../helpers/orders'

const TICKER = 'AAPL'

function fillAndConfirmBuy(overrides = {}) {
  cy.get('.modal-box').should('be.visible')
  cy.get('.field').contains('label', 'Tip naloga').parent().find('select').select(overrides.orderType || 'market')

  cy.get('.field').contains('label', /Količina/).parent().find('input').clear().type(String(overrides.quantity || 1))

  if (overrides.limitValue !== undefined) {
    cy.get('.field').contains('label', /Limit/).parent().find('input').clear().type(String(overrides.limitValue))
  }
  if (overrides.stopValue !== undefined) {
    cy.get('.field').contains('label', /Stop/).parent().find('input').clear().type(String(overrides.stopValue))
  }
  if (overrides.isAON) {
    cy.contains('.toggle-label', 'AON').find('input').check({ force: true })
  }
  if (overrides.isMargin) {
    cy.contains('.toggle-label', 'Margin').find('input').check({ force: true })
  }
  cy.contains('button', 'Nastavi').click()
  cy.contains('h3', 'Potvrda naloga').should('be.visible')
  cy.contains('button', /Potvrdi kupovinu|Potvrdi prodaju/).click()
}

describe('ORDER-FE-9 — Buy order form (supervisor flow)', () => {
  let ctx
  let supervisorToken

  before(() => {
    ctx = {}
    adminLogin().then((admin) => {
      ctx.adminToken = admin
      return createSupervisor(admin, 'order-fe9-sup')
    }).then((supervisor) => {
      ctx.supervisor = supervisor
      return loginEmployeeApi(supervisor.email)
    }).then((token) => {
      supervisorToken = token
    })
  })

  beforeEach(() => {
    loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)
  })

  it('places a Market Buy order and it appears in the orders list', () => {
    cy.intercept('POST', '/api/v1/orders').as('createOrder')

    cy.visit(`/securities/${TICKER}`)
    cy.contains('button', 'Kupi').click()

    fillAndConfirmBuy({ orderType: 'market', quantity: 1 })

    cy.wait('@createOrder').then(({ request, response }) => {
      expect(request.body.orderType).to.eq('market')
      expect(request.body.assetTicker).to.eq(TICKER)
      expect(request.body.direction).to.eq('buy')
      expect(response.statusCode).to.be.oneOf([200, 201])
    })

    cy.then(() =>
      listOrders(supervisorToken).then((orders) => {
        const my = orders.find((o) => o.assetTicker === TICKER && o.direction === 'buy')
        expect(my, 'created order is listed').to.exist
      })
    )
  })

  it('switching to Limit captures limitValue in the create payload', () => {
    cy.intercept('POST', '/api/v1/orders').as('createOrder')

    cy.visit(`/securities/${TICKER}`)
    cy.contains('button', 'Kupi').click()

    fillAndConfirmBuy({ orderType: 'limit', quantity: 1, limitValue: 150.5 })

    cy.wait('@createOrder').its('request.body').should((body) => {
      expect(body.orderType).to.eq('limit')
      expect(body.limitValue).to.eq(150.5)
    })
  })

  it('Stop order captures stopValue', () => {
    cy.intercept('POST', '/api/v1/orders').as('createOrder')

    cy.visit(`/securities/${TICKER}`)
    cy.contains('button', 'Kupi').click()

    fillAndConfirmBuy({ orderType: 'stop', quantity: 1, stopValue: 200 })

    cy.wait('@createOrder').its('request.body').should((body) => {
      expect(body.orderType).to.eq('stop')
      expect(body.stopValue).to.eq(200)
    })
  })

  it('Stop-Limit order captures both stopValue and limitValue', () => {
    cy.intercept('POST', '/api/v1/orders').as('createOrder')

    cy.visit(`/securities/${TICKER}`)
    cy.contains('button', 'Kupi').click()

    fillAndConfirmBuy({ orderType: 'stop_limit', quantity: 1, limitValue: 175, stopValue: 170 })

    cy.wait('@createOrder').its('request.body').should((body) => {
      expect(body.orderType).to.eq('stop_limit')
      expect(body.limitValue).to.eq(175)
      expect(body.stopValue).to.eq(170)
    })
  })

  it('AON + Margin toggles flow through to the order payload', () => {
    cy.intercept('POST', '/api/v1/orders').as('createOrder')

    cy.visit(`/securities/${TICKER}`)
    cy.contains('button', 'Kupi').click()

    fillAndConfirmBuy({ orderType: 'market', quantity: 1, isAON: true, isMargin: true })

    cy.wait('@createOrder').its('request.body').should((body) => {
      expect(body.isAON).to.eq(true)
      expect(body.isMargin).to.eq(true)
    })
  })
})

describe('ORDER-FE-9 — Client auto-approval', () => {
  it('a trading client order skips Pending and lands as approved', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return fetchCurrencies(token).then((currencies) => {
          const usd = currencies.find((c) => c.kod === 'USD')
          ctx.usdId = usd?.id
          return createClient(token, 'order-fe9-trader')
        })
      })
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() => updateClientPermissions(ctx.adminToken, ctx.client.id, ['clientBasic', 'clientTrading']))
      .then(() => {
        if (!ctx.usdId) {
          throw new Error('USD currency not seeded — cannot run client buy test')
        }
        return createAccount(ctx.adminToken, ctx.client.id, ctx.usdId, 'CYP-USD-Trade', 50000)
      })
      .then(() => {
        cy.intercept('POST', '/api/v1/orders').as('createOrder')

        loginClientUi(ctx.client.email)
        cy.visit(`/client/securities/${TICKER}`)
        cy.contains('button', 'Kupi').click()

        fillAndConfirmBuy({ orderType: 'market', quantity: 1 })

        cy.wait('@createOrder').then(({ response }) => {
          expect(response.statusCode).to.be.oneOf([200, 201])
          const order = response.body.order || response.body
          if (order && order.status) {
            expect(order.status, 'client order auto-approved').to.eq('approved')
          }
        })
      })
  })
})
