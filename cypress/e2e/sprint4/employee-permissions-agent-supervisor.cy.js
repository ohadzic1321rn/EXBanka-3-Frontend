// AKTUAR-FE-4 — admin can toggle Agent / Supervisor on a non-admin employee.
//
// The frontend exposes this through the Employees admin page: clicking "Edit"
// opens a modal whose "Permissions" tab renders a checkbox per permission
// (PermissionManager.vue). Saving PUTs /employees/:id/permissions.

import { adminLogin } from '../helpers/banking'
import { loginEmployeeUi, createEmployee } from '../helpers/employee'
import { createActivatedEmployee, listActuaries, DEFAULT_EMPLOYEE_PASSWORD } from '../helpers/actuary'

describe('AKTUAR-FE-4 — Agent/Supervisor permission toggles', () => {
  it('admin promotes a regular employee to Agent + Supervisor via the Employees page', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createEmployee(token, 'aktuar-fe4', { pozicija: 'Analyst' })
      })
      .then((employee) => {
        ctx.employee = employee

        loginEmployeeUi()

        cy.visit('/employees')
        cy.contains('h1', 'Employees').should('be.visible')

        cy.get('input[placeholder="Filter by email"]').clear().type(ctx.employee.email)
        cy.contains('button', 'Search').click()

        cy.contains('tr', ctx.employee.email).within(() => {
          cy.contains('button', 'Edit').click()
        })

        cy.contains('.modal, [role="dialog"], div', 'Save Changes').should('be.visible')
        cy.contains('button, a, span, li', 'Permissions').click()

        cy.contains('.permission-item', 'employeeAgent')
          .find('input[type="checkbox"]')
          .check({ force: true })
        cy.contains('.permission-item', 'employeeSupervisor')
          .find('input[type="checkbox"]')
          .check({ force: true })

        cy.contains('button', 'Save Changes').click()

        cy.contains('button', 'Save Changes').should('not.exist')

        cy.then(() =>
          listActuaries(ctx.adminToken).then((actuaries) => {
            const row = actuaries.find((a) => String(a.employeeId) === String(ctx.employee.id))
            expect(row, 'employee surfaces in /actuaries listing').to.exist
            expect(row.isActuary, 'isActuary flag').to.equal(true)
            expect(row.isSupervisor, 'isSupervisor flag').to.equal(true)
          })
        )
      })
  })

  it('admin row offers no Edit button (admins are not editable)', () => {
    adminLogin().then(() => {
      loginEmployeeUi()
      cy.visit('/employees')

      cy.get('input[placeholder="Filter by email"]').clear().type('admin@bank.com')
      cy.contains('button', 'Search').click()

      cy.contains('tr', 'admin@bank.com').within(() => {
        cy.contains('Admin').should('be.visible')
        cy.contains('button', 'Edit').should('not.exist')
      })
    })
  })

  it('non-admin employees cannot reach /employees (route is admin-only)', () => {
    const ctx = {}

    adminLogin()
      .then((token) => {
        ctx.adminToken = token
        return createActivatedEmployee(token, 'aktuar-fe4-agent', ['employeeAgent'], {
          pozicija: 'Agent',
        })
      })
      .then((employee) => {
        ctx.employee = employee
        loginEmployeeUi(employee.email, DEFAULT_EMPLOYEE_PASSWORD)
        cy.visit('/employees')
        cy.url().should('match', /\/clients$/)
        cy.contains('h1', 'Employees').should('not.exist')
      })
  })
})
