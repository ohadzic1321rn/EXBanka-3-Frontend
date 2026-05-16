// POREZ-FE-6 — Supervisor tax tracking portal at /tax.
//
// Verifies seeded tax_records render, filters narrow rows, and that
// "Pokreni obračun" debits the user's RSD account, credits the
// Republika Srbija RSD treasury, and marks the records paid.

import {
  adminLogin,
  createClient,
  activateClient,
  fetchCurrencies,
  createAccount,
} from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'
import { createSupervisor, DEFAULT_EMPLOYEE_PASSWORD } from '../helpers/actuary'
import { lookupListingId, seedTaxRecord } from '../helpers/orders'

const TICKER = 'AAPL'

function currentPeriod() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM (UTC)
}

function fetchAccountBalance(accountId) {
  return cy
    .task('dbExec', {
      sql: 'SELECT raspolozivo_stanje FROM accounts WHERE id = $1',
      params: [accountId],
    })
    .then(({ rows }) => Number(rows[0]?.raspolozivo_stanje ?? 0))
}

function findStateTreasuryAccount() {
  return cy
    .task('dbExec', {
      sql: `
        SELECT a.id, a.raspolozivo_stanje
        FROM accounts a
        JOIN currencies c ON c.id = a.currency_id
        WHERE LOWER(a.naziv) LIKE '%republika srbija%'
          AND c.kod = 'RSD'
          AND a.status = 'aktivan'
        LIMIT 1
      `,
      params: [],
    })
    .then(({ rows }) => {
      expect(rows[0], 'Republika Srbija RSD treasury account exists').to.exist
      return { id: Number(rows[0].id), balance: Number(rows[0].raspolozivo_stanje) }
    })
}

function seedTaxFor({ userId, userType = 'client', period, profitRsd, taxRsd, status }) {
  return lookupListingId(TICKER).then((assetId) =>
    seedTaxRecord({ userId, userType, assetId, profitRsd, taxRsd, period, status })
  )
}

describe('POREZ-FE-6 — Supervisor tax tracking portal', () => {
  beforeEach(function () {
    this.ctx = {}
    adminLogin()
      .then((admin) => {
        this.ctx.adminToken = admin
        return createSupervisor(admin, `fe6-sup-${Date.now()}`)
      })
      .then((supervisor) => {
        this.ctx.supervisor = supervisor
      })
  })

  it('supervisor sees a seeded TaxRecord with RSD profit and 15% tax', function () {
    const ctx = this.ctx
    const period = currentPeriod()

    createClient(ctx.adminToken, 'fe6-tax-client')
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() =>
        seedTaxFor({
          userId: Number(ctx.client.id),
          period,
          profitRsd: 10000,
          taxRsd: 1500,
        })
      )
      .then(() => {
        loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/tax')

        cy.contains('h1', 'Porez na kapitalnu dobit').should('be.visible')
        cy.contains('tr.has-debt', ctx.client.ime).within(() => {
          cy.contains('td', '1,500.00').should('be.visible')
          cy.contains('.type-badge.client', 'Klijent').should('be.visible')
        })
      })
  })

  it('filters tax list by user name and type', function () {
    const ctx = this.ctx
    const period = currentPeriod()

    createClient(ctx.adminToken, 'fe6-filter-client')
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() =>
        seedTaxFor({
          userId: Number(ctx.client.id),
          userType: 'client',
          period,
          profitRsd: 8000,
          taxRsd: 1200,
        })
      )
      .then(() =>
        seedTaxFor({
          userId: 0,
          userType: 'bank',
          period,
          profitRsd: 6000,
          taxRsd: 900,
        })
      )
      .then(() => {
        loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/tax')

        cy.contains('tr', ctx.client.ime).should('be.visible')
        cy.contains('tr', 'EXBanka').should('be.visible')

        cy.contains('.tab-btn', 'Klijenti').click()
        cy.contains('tr', ctx.client.ime).should('be.visible')
        cy.contains('tr', 'EXBanka').should('not.exist')

        cy.contains('.tab-btn', 'Banka').click()
        cy.contains('tr', 'EXBanka').should('be.visible')
        cy.contains('tr', ctx.client.ime).should('not.exist')

        cy.contains('.tab-btn', 'Svi').click()
        cy.get('.search-input').clear().type(ctx.client.ime)
        cy.contains('tr', ctx.client.ime).should('be.visible')
        cy.contains('tr', 'EXBanka').should('not.exist')
      })
  })

  it('Pokreni obracun debits the user and credits Republika Srbija RSD account', function () {
    const ctx = this.ctx
    const period = currentPeriod()
    const TAX = 1500
    const STARTING_BALANCE = 10000

    fetchCurrencies(ctx.adminToken)
      .then((currencies) => {
        ctx.rsdId = currencies.find((c) => c.kod === 'RSD')?.id
        expect(ctx.rsdId, 'RSD currency seeded').to.exist
        return createClient(ctx.adminToken, 'fe6-collect-client')
      })
      .then((client) => {
        ctx.client = client
        return activateClient(client.setupToken)
      })
      .then(() =>
        createAccount(
          ctx.adminToken,
          ctx.client.id,
          ctx.rsdId,
          `CYP-RSD-tax-${Date.now()}`,
          STARTING_BALANCE
        )
      )
      .then((account) => {
        ctx.clientAccountId = account.id
        return findStateTreasuryAccount()
      })
      .then((treasury) => {
        ctx.treasuryId = treasury.id
        ctx.treasuryBalanceBefore = treasury.balance
        return seedTaxFor({
          userId: Number(ctx.client.id),
          userType: 'client',
          period,
          profitRsd: 10000,
          taxRsd: TAX,
        })
      })
      .then(({ taxRecordId }) => {
        ctx.taxRecordId = taxRecordId

        loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/tax')

        cy.contains('h1', 'Porez na kapitalnu dobit').should('be.visible')
        cy.contains('button', 'Pokreni obračun').click()

        cy.get('.success-box', { timeout: 15000 })
          .should('contain', 'Obračun završen')
          .and('contain', period)

        cy.then(() => fetchAccountBalance(ctx.treasuryId)).then((after) => {
          // Other unpaid tax records may also have settled in the same run;
          // assert at minimum this client's tax landed in the treasury.
          expect(after, 'state treasury credited at least the test tax amount').to.be.gte(
            ctx.treasuryBalanceBefore + TAX - 0.01
          )
        })

        cy.then(() => fetchAccountBalance(ctx.clientAccountId)).then((after) => {
          expect(after, 'client RSD debited tax amount').to.be.closeTo(
            STARTING_BALANCE - TAX,
            0.01
          )
        })

        cy.then(() =>
          cy.task('dbExec', {
            sql: 'SELECT status FROM tax_records WHERE id = $1',
            params: [ctx.taxRecordId],
          })
        ).then(({ rows }) => {
          expect(rows[0].status, 'tax record marked paid').to.eq('paid')
        })
      })
  })
})
