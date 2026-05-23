// OTC + SAGA helpers shared between Sprint 6 and Sprint 7 specs.
//
// These helpers are intentionally direct-to-DB for setup: getting a stock onto
// the OTC portal otherwise requires placing real market orders, which is too
// brittle to script around. Spec assertions still drive the UI through the
// real handlers so the recorded video shows the end-to-end flow.

import { API_BASE } from './banking.js'

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

/**
 * Seed a portfolio holding that is already exposed on the OTC portal.
 * Differs from helpers/orders.js#seedHolding in that is_public=true and
 * public_quantity > 0 — required for ListPublicOTCHoldings to surface it.
 */
export function seedPublicHolding({
  userId,
  userType,
  assetId,
  accountId,
  quantity,
  publicQuantity,
  reservedQuantity = 0,
  avgBuyPrice = 0,
}) {
  const sql = `
    INSERT INTO portfolio_holdings
      (user_id, user_type, asset_id, quantity, avg_buy_price,
       reserved_quantity, public_quantity, is_public, realized_profit,
       account_id, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, TRUE, 0, $8, NOW(), NOW())
    RETURNING id
  `
  return cy
    .task('dbExec', {
      sql,
      params: [
        userId,
        userType,
        assetId,
        quantity,
        avgBuyPrice,
        reservedQuantity,
        publicQuantity,
        accountId,
      ],
    })
    .then(({ rows }) => {
      const id = rows[0]?.id
      expect(id, 'seeded public holding id').to.exist
      return { holdingId: Number(id) }
    })
}

/**
 * Seed a valid OTC contract between two users. Returns the contract row id.
 * Settlement is set 5 days into the future so the contract is exercisable.
 */
export function seedOtcContract({
  stockListingId,
  sellerHoldingId,
  amount,
  strikePrice,
  premium,
  buyerId,
  buyerType,
  buyerAccountId,
  sellerId,
  sellerType,
  sellerAccountId,
  daysUntilSettlement = 5,
}) {
  const sql = `
    INSERT INTO otc_contracts
      (stock_listing_id, seller_holding_id, amount, strike_price, premium,
       settlement_date, buyer_id, buyer_type, buyer_account_id,
       seller_id, seller_type, seller_account_id,
       status, exercised_at_price, buyer_profit, seller_profit,
       created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5,
       (NOW() + ($6 || ' days')::interval)::date,
       $7, $8, $9,
       $10, $11, $12,
       'valid', 0, 0, 0,
       NOW(), NOW())
    RETURNING id
  `
  return cy
    .task('dbExec', {
      sql,
      params: [
        stockListingId,
        sellerHoldingId,
        amount,
        strikePrice,
        premium,
        String(daysUntilSettlement),
        buyerId,
        buyerType,
        buyerAccountId,
        sellerId,
        sellerType,
        sellerAccountId,
      ],
    })
    .then(({ rows }) => {
      const id = rows[0]?.id
      expect(id, 'seeded otc contract id').to.exist
      return { contractId: Number(id) }
    })
}

/**
 * Grant clientTrading to a freshly-created client so they can hit /client/otc*.
 */
export function grantClientTrading(adminToken, clientId) {
  return cy.request({
    method: 'PUT',
    url: `${API_BASE}/clients/${clientId}/permissions`,
    headers: authHeader(adminToken),
    body: { permission_names: ['clientBasic', 'clientTrading'] },
  })
}

/** Returns the raspolozivo_stanje of an account as a JS number. */
export function fetchAccountBalance(accountId) {
  return cy
    .task('dbExec', {
      sql: 'SELECT raspolozivo_stanje FROM accounts WHERE id = $1',
      params: [accountId],
    })
    .then(({ rows }) => Number(rows[0]?.raspolozivo_stanje ?? 0))
}

/** Returns { quantity, reserved_quantity } for a holding. */
export function fetchHoldingQuantities(holdingId) {
  return cy
    .task('dbExec', {
      sql:
        'SELECT quantity, reserved_quantity, public_quantity FROM portfolio_holdings WHERE id = $1',
      params: [holdingId],
    })
    .then(({ rows }) => ({
      quantity: Number(rows[0]?.quantity ?? 0),
      reservedQuantity: Number(rows[0]?.reserved_quantity ?? 0),
      publicQuantity: Number(rows[0]?.public_quantity ?? 0),
    }))
}

/** Returns the contract row as an object. */
export function fetchOtcContract(contractId) {
  return cy
    .task('dbExec', {
      sql:
        'SELECT id, status, amount, strike_price, premium, exercised_at_price, buyer_id, seller_id FROM otc_contracts WHERE id = $1',
      params: [contractId],
    })
    .then(({ rows }) => rows[0])
}

/** Returns the otc offer row as an object. */
export function fetchOtcOffer(offerId) {
  return cy
    .task('dbExec', {
      sql:
        'SELECT id, status, amount, price_per_stock, premium, modified_by_id, modified_by_type FROM otc_offers WHERE id = $1',
      params: [offerId],
    })
    .then(({ rows }) => rows[0])
}

/** Quick lookup of the buyer-side OTC offer for a given seller holding. */
export function findLatestOfferForHolding(sellerHoldingId) {
  return cy
    .task('dbExec', {
      sql:
        'SELECT id, status FROM otc_offers WHERE seller_holding_id = $1 ORDER BY id DESC LIMIT 1',
      params: [sellerHoldingId],
    })
    .then(({ rows }) => rows[0])
}
