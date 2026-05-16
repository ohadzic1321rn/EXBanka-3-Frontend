import { defineConfig } from 'cypress'
import { cleanupCypressData } from './cypress/support/db-cleanup.js'
import { dbExec } from './cypress/support/db-seed.js'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    setupNodeEvents(on) {
      on('after:run', () => {
        cleanupCypressData()
      })
      on('task', { dbExec })
    },
  },
  env: {
    adminEmail: 'admin@bank.com',
    adminPassword: 'Admin123!',
    clientPassword: 'ClientPass12',
  },
  viewportWidth: 1440,
  viewportHeight: 900,
  defaultCommandTimeout: 10000,
  requestTimeout: 15000,
  responseTimeout: 15000,
})
