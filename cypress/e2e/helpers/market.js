import { API_BASE } from './banking.js'

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

export function listExchanges(token) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/exchanges`,
      headers: authHeader(token),
    })
    .then(({ body }) => body.exchanges || [])
}

export function getExchange(token, acronym) {
  return listExchanges(token).then((exchanges) => {
    const match = exchanges.find((e) => e.acronym === acronym || e.micCode === acronym)
    expect(match, `exchange ${acronym}`).to.exist
    return match
  })
}

export function toggleExchange(supervisorToken, acronym, useManualTime, manualTimeOpen) {
  return cy.request({
    method: 'POST',
    url: `${API_BASE}/exchanges/${acronym}/toggle`,
    headers: authHeader(supervisorToken),
    body: { useManualTime, manualTimeOpen },
  })
}

export function listListings(token, params = {}) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/listings`,
      headers: authHeader(token),
      qs: params,
    })
    .then(({ body }) => body.listings || [])
}

export function getListing(token, ticker) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/listings/${ticker}`,
      headers: authHeader(token),
    })
    .then(({ body }) => body.listing)
}

export function getListingHistory(token, ticker) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/listings/${ticker}/history`,
      headers: authHeader(token),
    })
    .then(({ body }) => body.history || [])
}

export function getOptionsChain(token, ticker) {
  return cy
    .request({
      method: 'GET',
      url: `${API_BASE}/listings/${ticker}/options`,
      headers: authHeader(token),
      failOnStatusCode: false,
    })
    .then(({ body, status }) => {
      if (status !== 200) return { ticker, stockPrice: 0, options: [], count: 0 }
      return body
    })
}

export function findStockWithOptions(token) {
  return listListings(token, { type: 'stock' }).then((stocks) => {
    const tickers = stocks.map((s) => s.ticker)
    const tryNext = (idx) => {
      if (idx >= tickers.length) {
        throw new Error('No stock with options found among listings')
      }
      return getOptionsChain(token, tickers[idx]).then((chain) => {
        if (chain.options && chain.options.length > 0) return chain
        return tryNext(idx + 1)
      })
    }
    return tryNext(0)
  })
}
