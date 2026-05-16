// ORDER-FE-11 — Supervisor order review portal at /orders.
//
// To produce a "pending" order we toggle the agent's needApproval to true and
// place an order via that agent's JWT before the supervisor UI test runs.

import { adminLogin } from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'
import {
  createAgent,
  createSupervisor,
  loginEmployeeApi,
  setNeedApproval,
  DEFAULT_EMPLOYEE_PASSWORD,
} from '../helpers/actuary'
import { createOrder, listOrders, buildOrderPayload } from '../helpers/orders'

const TICKER = 'AAPL'

function pickBankUsdAccount(supervisorToken) {
  return cy
    .request({
      method: 'GET',
      url: '/api/v1/accounts',
      headers: { Authorization: `Bearer ${supervisorToken}` },
      qs: { status: 'aktivan', pageSize: 200 },
    })
    .then(({ body }) => {
      const items = body.accounts || body.content || body || []
      const bank = items.find((a) =>
        (!a.clientId || a.clientId === '0' || a.clientId === 0) &&
        !(a.naziv || '').toLowerCase().includes('republika') &&
        (a.currencyKod === 'USD')
      )
      expect(bank, 'a bank USD account exists in seed data').to.exist
      return bank
    })
}

function seedPendingOrder(ctx) {
  return setNeedApproval(ctx.supervisorToken, ctx.agent.id, true)
    .then(() => loginEmployeeApi(ctx.agent.email))
    .then((agentToken) => {
      ctx.agentToken = agentToken
      return pickBankUsdAccount(ctx.supervisorToken)
    })
    .then((account) => {
      ctx.bankAccount = account
      return createOrder(ctx.agentToken, buildOrderPayload({
        assetTicker: TICKER,
        orderType: 'market',
        direction: 'buy',
        quantity: 1,
        accountId: Number(account.id),
      }))
    })
    .then(({ status, body }) => {
      expect(status, 'order create status').to.be.oneOf([200, 201])
      ctx.order = body.order || body
      expect(ctx.order.status, 'agent order pended for approval').to.eq('pending')
    })
}

describe('ORDER-FE-11 — Supervisor order review portal', () => {
  beforeEach(function () {
    this.ctx = {}
    adminLogin()
      .then((admin) => {
        this.ctx.adminToken = admin
        return createSupervisor(admin, `fe11-sup-${Date.now()}`)
      })
      .then((supervisor) => {
        this.ctx.supervisor = supervisor
        return loginEmployeeApi(supervisor.email)
      })
      .then((token) => {
        this.ctx.supervisorToken = token
        return createAgent(this.ctx.adminToken, `fe11-agent-${Date.now()}`)
      })
      .then((agent) => {
        this.ctx.agent = agent
      })
  })

  it('supervisor approves a pending order — it moves from Pending to Approved', function () {
    const ctx = this.ctx
    seedPendingOrder(ctx).then(() => {
      loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)
      cy.visit('/orders')
      cy.contains('h1', 'Pregled naloga').should('be.visible')

      cy.contains('.tab-btn', 'Na čekanju').click()
      cy.contains('tr', `${ctx.order.id}`).within(() => {
        cy.contains('button', 'Odobri').click()
      })

      cy.contains('.tab-btn', 'Odobreni').click()
      cy.contains('tr', `${ctx.order.id}`).should('exist')

      cy.then(() =>
        listOrders(ctx.supervisorToken).then((orders) => {
          const o = orders.find((x) => x.id === ctx.order.id)
          expect(o.status).to.eq('approved')
        })
      )
    })
  })

  it('supervisor declines a pending order — it moves to Declined', function () {
    const ctx = this.ctx
    seedPendingOrder(ctx).then(() => {
      loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)
      cy.visit('/orders')

      cy.contains('.tab-btn', 'Na čekanju').click()
      cy.contains('tr', `${ctx.order.id}`).within(() => {
        cy.contains('button', 'Odbij').click()
      })

      cy.contains('.tab-btn', 'Odbijeni').click()
      cy.contains('tr', `${ctx.order.id}`).should('exist')

      cy.then(() =>
        listOrders(ctx.supervisorToken).then((orders) => {
          const o = orders.find((x) => x.id === ctx.order.id)
          expect(o.status).to.eq('declined')
        })
      )
    })
  })

  it('supervisor cancels an approved order — it moves to Cancelled', function () {
    const ctx = this.ctx
    seedPendingOrder(ctx)
      .then(() =>
        cy.request({
          method: 'POST',
          url: `/api/v1/orders/${ctx.order.id}/approve`,
          headers: { Authorization: `Bearer ${ctx.supervisorToken}` },
        })
      )
      .then(() => {
        loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/orders')

        cy.contains('.tab-btn', 'Odobreni').click()
        cy.contains('tr', `${ctx.order.id}`).within(() => {
          cy.contains('button', 'Otkaži').click()
        })

        cy.contains('.tab-btn', 'Otkazani').click()
        cy.contains('tr', `${ctx.order.id}`).should('exist')

        cy.then(() =>
          listOrders(ctx.supervisorToken).then((orders) => {
            const o = orders.find((x) => x.id === ctx.order.id)
            expect(o.status).to.eq('cancelled')
          })
        )
      })
  })

  it('non-supervisor agent is redirected from /orders', function () {
    const ctx = this.ctx
    loginEmployeeUi(ctx.agent.email, DEFAULT_EMPLOYEE_PASSWORD)
    cy.visit('/orders')
    cy.url().should('match', /\/clients$/)
  })
})
