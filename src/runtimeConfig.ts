// Runtime config — read from window.__APP_CONFIG__ so the same built bundle
// can be deployed to dev (same-origin nginx proxy) and to the college K8s
// cluster (different domain, https, per-service URL slug) without rebuilding.
//
// The values are populated by /config.js, which is loaded synchronously from
// index.html. In dev that file ships with empty defaults (public/config.js).
// In the cluster, the container entrypoint regenerates /config.js from env
// vars at startup (API_ORIGIN, USE_SLUGS).

declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiOrigin?: string
      useSlugs?: boolean | string
    }
  }
}

const cfg = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {}

export const apiOrigin: string = cfg.apiOrigin ?? ''
export const useSlugs: boolean = cfg.useSlugs === true || cfg.useSlugs === 'true'

// Resource-prefix → service-slug map. Source of truth is the Progress log in
// `K8 deployment to college K8 cluster.md` (step 2). The order matters because
// /api/v1/exchanges (plural) and /api/v1/exchange (singular) both belong to
// exchange-service but the singular would partial-match the plural without the
// (\/|$) anchor.
const SLUG_MAP: Array<[RegExp, string]> = [
  [/^\/api\/v1\/auth(\/|$)/, 'auth'],
  [/^\/api\/v1\/permissions(\/|$)/, 'employee'],
  [/^\/api\/v1\/employees(\/|$)/, 'employee'],
  [/^\/api\/v1\/actuaries(\/|$)/, 'employee'],
  [/^\/api\/v1\/audit-logs(\/|$)/, 'employee'],
  [/^\/api\/v1\/clients(\/|$)/, 'client'],
  [/^\/api\/v1\/firme(\/|$)/, 'account'],
  [/^\/api\/v1\/sifre-delatnosti(\/|$)/, 'account'],
  [/^\/api\/v1\/currencies(\/|$)/, 'account'],
  [/^\/api\/v1\/accounts(\/|$)/, 'account'],
  [/^\/api\/v1\/cards(\/|$)/, 'account'],
  [/^\/api\/v1\/transfers(\/|$)/, 'transfer'],
  [/^\/api\/v1\/payments(\/|$)/, 'payment'],
  [/^\/api\/v1\/prenos(\/|$)/, 'payment'],
  [/^\/api\/v1\/recipients(\/|$)/, 'payment'],
  [/^\/api\/v1\/listings(\/|$)/, 'exchange'],
  [/^\/api\/v1\/portfolio(\/|$)/, 'exchange'],
  [/^\/api\/v1\/orders(\/|$)/, 'exchange'],
  [/^\/api\/v1\/tax(\/|$)/, 'exchange'],
  [/^\/api\/v1\/otc(\/|$)/, 'exchange'],
  [/^\/api\/v1\/interbank-otc(\/|$)/, 'exchange'],
  [/^\/api\/v1\/funds(\/|$)/, 'exchange'],
  [/^\/api\/v1\/exchanges(\/|$)/, 'exchange'],
  [/^\/api\/v1\/exchange(\/|$)/, 'exchange'],
  [/^\/api\/v1\/watchlists(\/|$)/, 'exchange'],
  [/^\/api\/v1\/price-alerts(\/|$)/, 'exchange'],
  [/^\/api\/v1\/loans(\/|$)/, 'loan'],
  [/^\/api\/v1\/notifications(\/|$)/, 'notification'],
]

const FALLBACK_SLUG = 'core'

function slugForPath(path: string): string {
  for (const [re, slug] of SLUG_MAP) {
    if (re.test(path)) return slug
  }
  return FALLBACK_SLUG
}

// Resolve an /api/v1/... path to the final URL based on runtime config.
// - Dev (useSlugs=false, apiOrigin=""): returns path unchanged. Same-origin
//   nginx routes by resource prefix exactly like today.
// - Cluster (useSlugs=true, apiOrigin="https://<domain>"): returns
//   `${apiOrigin}/<slug>${path}`. Ingress strips `/<slug>/` and forwards the
//   remainder to the upstream service.
export function resolveApiUrl(path: string): string {
  if (!useSlugs) return apiOrigin + path
  const slug = slugForPath(path)
  return `${apiOrigin}/${slug}${path}`
}
