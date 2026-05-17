const API_BASE = '/api/v1'

export function adminLogin() {
  return cy
    .request('POST', `${API_BASE}/auth/login`, {
      email: Cypress.env('adminEmail'),
      password: Cypress.env('adminPassword'),
    })
    .its('body.accessToken')
}

export function fetchCurrencies(employeeToken) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/currencies`,
      headers: { Authorization: `Bearer ${employeeToken}` },
    })
    .then(({ body }) => body.currencies || [])
}

export function createClient(employeeToken, label, overrides = {}) {
  const timestamp = Date.now()
  const email = overrides.email || `cypress.${label}.${timestamp}@example.com`
  const firstName = overrides.ime || 'Cypress'
  const lastName = overrides.prezime || 'Client'

  return cy
    .request({
      method: 'POST',
      url: `${API_BASE}/clients`,
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: {
        ime: firstName,
        prezime: lastName,
        datumRodjenja: 946684800,
        pol: 'M',
        email,
        brojTelefona: overrides.brojTelefona || '0611234567',
        adresa: overrides.adresa || 'Cypress Test 1',
      },
    })
    .then(({ body }) => {
      const tokenMatch = body.message.match(/token:\s*(.+)$/)
      expect(tokenMatch, 'setup token').to.not.be.null

      return {
        id: String(body.client.id),
        ime: firstName,
        prezime: lastName,
        email,
        setupToken: tokenMatch[1].trim(),
      }
    })
}

export function activateClient(setupToken, password = Cypress.env('clientPassword')) {
  return cy.request('POST', `${API_BASE}/auth/client/activate`, {
    token: setupToken,
    password,
    passwordConfirm: password,
  })
}

export function loginClientUi(email, password = Cypress.env('clientPassword')) {
  cy.visit('/client/login', {
    onBeforeLoad(win) {
      win.sessionStorage.clear()
    },
  })
  cy.get('input[type="email"]').clear().type(email)
  cy.get('input[type="password"]').clear().type(password)
  cy.contains('button', 'Sign In').click()
  cy.url().should('include', '/client/dashboard')
}

export function updateClientPermissions(employeeToken, clientId, permissionNames) {
  return cy.request({
    method: 'PUT',
    url: `${API_BASE}/clients/${clientId}/permissions`,
    headers: { Authorization: `Bearer ${employeeToken}` },
    body: { permission_names: permissionNames },
  })
}

export function createAccount(employeeToken, clientId, currencyId, naziv, pocetnoStanje, overrides = {}) {
  const tip = overrides.tip || 'tekuci'
  const body = {
    clientId: Number(clientId),
    currencyId,
    tip,
    vrsta: overrides.vrsta || 'licni',
    naziv,
    pocetnoStanje,
    ...(overrides.firmaId ? { firmaId: overrides.firmaId } : {}),
  }
  if (tip !== 'devizni') {
    body.podvrsta = overrides.podvrsta || 'standardni'
  }
  return cy
    .request({
      method: 'POST',
      url: `${API_BASE}/accounts/create`,
      headers: { Authorization: `Bearer ${employeeToken}` },
      body,
    })
    .its('body.account')
}

export function createCard(employeeToken, payload) {
  return cy
    .request({
      method: 'POST',
      url: `${API_BASE}/cards`,
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: payload,
    })
    .then(({ body }) => body.card || body)
}

export function fetchOtp(toEmail, bodyHint, attempt = 0) {
  return cy.request('GET', 'http://localhost:8025/api/v2/messages').then(({ body }) => {
    const items = body.items || []
    const match = items.find((item) => {
      const toHeader = (item.Content?.Headers?.To || []).join(' ')
      const mailBody = item.Content?.Body || ''
      return toHeader.includes(toEmail) && mailBody.includes(bodyHint)
    })

    if (match) {
      const otpMatch = (match.Content?.Body || '').match(/\b\d{6}\b/)
      expect(otpMatch, 'OTP code').to.not.be.null
      return otpMatch[0]
    }

    if (attempt >= 10) {
      throw new Error(`OTP not found for ${toEmail} / ${bodyHint}`)
    }

    cy.wait(1000)
    return fetchOtp(toEmail, bodyHint, attempt + 1)
  })
}

export { API_BASE }
