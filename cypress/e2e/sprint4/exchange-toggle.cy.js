// BERZA-BE-2 (FE surface) — supervisor manual exchange-time toggle on /exchanges/toggle.
//
// Buttons per exchange card: Postavi OTVORENO | Postavi ZATVORENO | Vrati na realno vreme

import { adminLogin } from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'
import { createAgent, createSupervisor, loginEmployeeApi, DEFAULT_EMPLOYEE_PASSWORD } from '../helpers/actuary'
import { getExchange, toggleExchange } from '../helpers/market'

const TARGET_ACRONYM = 'NASDAQ'

describe('Exchange manual-time toggle (BERZA-BE-2 FE surface)', () => {
  it('supervisor flips NASDAQ to manual OPEN and back to real-time', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createSupervisor(token, 'fe-tog-sup')
      })
      .then((supervisor) => {
        ctx.supervisor = supervisor
        return loginEmployeeApi(supervisor.email)
      })
      .then((supervisorToken) => {
        ctx.supervisorToken = supervisorToken
        return getExchange(supervisorToken, TARGET_ACRONYM)
      })
      .then((original) => {
        ctx.originalUseManual = original.useManualTime
        ctx.originalManualOpen = original.manualTimeOpen

        loginEmployeeUi(ctx.supervisor.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/exchanges/toggle')
        cy.contains('h1', 'Testiranje berzi').should('be.visible')

        cy.contains('.exchange-card', TARGET_ACRONYM).as('card')
        cy.get('@card').contains('button', 'Postavi OTVORENO').click()
        cy.get('@card').should('have.class', 'manual-open')
        cy.get('@card').contains('.badge.manual', /OTVORENO/).should('be.visible')

        cy.then(() => getExchange(ctx.supervisorToken, TARGET_ACRONYM))
          .then((after) => {
            expect(after.useManualTime, 'manual mode on').to.equal(true)
            expect(after.manualTimeOpen, 'open flag set').to.equal(true)
          })

        cy.get('@card').contains('button', 'Vrati na realno vreme').click()
        cy.get('@card').should('not.have.class', 'manual-open')
        cy.get('@card').contains('.badge.real', 'REALNO').should('be.visible')
      })
      .then(() => {
        if (ctx.supervisorToken) {
          toggleExchange(ctx.supervisorToken, TARGET_ACRONYM, ctx.originalUseManual, ctx.originalManualOpen)
        }
      })
  })

  it('agent (non-supervisor) is redirected from /exchanges/toggle', () => {
    adminLogin()
      .then((token) => createAgent(token, 'fe-tog-agent'))
      .then((agent) => {
        loginEmployeeUi(agent.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/exchanges/toggle')
        cy.url().should('match', /\/clients$/)
      })
  })
})
