import { API_BASE } from './banking.js'

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

const DEFAULT_PAYLOAD = {
  orderType: 'market',
  direction: 'buy',
  quantity: 1,
  isAON: false,
  isMargin: false,
  afterHours: false,
}

export function buildOrderPayload(overrides) {
  return { ...DEFAULT_PAYLOAD, ...overrides }
}

export function createOrder(token, payload) {
  return cy
    .request({
      method: 'POST',
      url: `${API_BASE}/orders`,
      headers: authHeader(token),
      body: payload,
      failOnStatusCode: false,
    })
    .then(({ status, body }) => ({ status, body }))
}

export function listOrders(token, params = {}) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/orders`,
      headers: authHeader(token),
      qs: params,
    })
    .then(({ body }) => body.orders || [])
}

export function getOrder(token, id) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/orders/${id}`,
      headers: authHeader(token),
    })
    .then(({ body }) => body.order)
}

export function approveOrder(supervisorToken, id) {
  return cy.request({
    method: 'POST',
    url: `${API_BASE}/orders/${id}/approve`,
    headers: authHeader(supervisorToken),
  })
}

export function declineOrder(supervisorToken, id) {
  return cy.request({
    method: 'POST',
    url: `${API_BASE}/orders/${id}/decline`,
    headers: authHeader(supervisorToken),
  })
}

export function cancelOrder(token, id, newRemaining = 0) {
  return cy.request({
    method: 'POST',
    url: `${API_BASE}/orders/${id}/cancel`,
    headers: authHeader(token),
    body: { newRemaining },
  })
}

export function listTransactions(token, orderId) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/orders/${orderId}/transactions`,
      headers: authHeader(token),
    })
    .then(({ body }) => body.transactions || [])
}

export function listHoldings(token) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/portfolio/holdings`,
      headers: authHeader(token),
    })
    .then(({ body }) => body.holdings || [])
}

/**
 * Seed a portfolio holding directly via SQL.
 * Returns { holdingId } after insert.
 */
export function seedHolding({
  userId,
  userType,
  assetId,
  assetType = 'stock',
  quantity,
  avgBuyPrice,
  accountId,
}) {
  const sql = `
    INSERT INTO portfolio_holdings
      (user_id, user_type, asset_id, asset_type, quantity, avg_buy_price,
       reserved_quantity, public_quantity, is_public, realized_profit,
       account_id, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, 0, 0, FALSE, 0, $7, NOW(), NOW())
    RETURNING id
  `
  return cy
    .task('dbExec', { sql, params: [userId, userType, assetId, assetType, quantity, avgBuyPrice, accountId] })
    .then((result) => {
      const id = result.rows[0]?.id
      expect(id, 'seeded holding id').to.exist
      return { holdingId: id }
    })
}

/**
 * Seed a tax_record directly. Returns { taxRecordId }.
 */
export function seedTaxRecord({
  userId,
  userType,
  assetId,
  profitRsd,
  taxRsd,
  period,
  status = 'unpaid',
}) {
  const sql = `
    INSERT INTO tax_records
      (user_id, user_type, asset_id, profit_rsd, tax_rsd, period, status, created_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id
  `
  return cy
    .task('dbExec', {
      sql,
      params: [userId, userType, assetId, profitRsd, taxRsd, period, status],
    })
    .then((result) => {
      const id = result.rows[0]?.id
      expect(id, 'seeded tax_record id').to.exist
      return { taxRecordId: id }
    })
}

/**
 * Resolve a listing's asset_id (the FK used by portfolio_holdings.asset_id).
 * Holdings reference market_listings.id directly (polymorphic-ish through Asset).
 */
export function lookupListingId(ticker) {
  return cy
    .task('dbExec', {
      sql: 'SELECT id FROM market_listings WHERE ticker = $1 LIMIT 1',
      params: [ticker],
    })
    .then(({ rows }) => {
      expect(rows[0], `market_listings row for ${ticker}`).to.exist
      return rows[0].id
    })
}
