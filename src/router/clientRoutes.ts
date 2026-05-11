import type { RouteRecordRaw } from 'vue-router'

export const clientRoutes: RouteRecordRaw[] = [
  {
    path: '/client/login',
    component: () => import('../views/client/ClientLoginView.vue'),
    meta: { public: true, clientPublic: true },
  },
  {
    path: '/client',
    component: () => import('../views/client/ClientLayout.vue'),
    meta: { clientOnly: true },
    children: [
      { path: '', redirect: '/client/dashboard' },
      {
        path: 'dashboard',
        component: () => import('../views/client/ClientDashboardView.vue'),
      },
      {
        path: 'accounts',
        component: () => import('../views/client/ClientAccountsView.vue'),
      },
      {
        path: 'securities',
        component: () => import('../views/client/ClientSecuritiesView.vue'),
        meta: { clientTradingOnly: true },
      },
      {
        path: 'securities/:ticker(.+)',
        component: () => import('../views/client/ClientSecurityDetailsView.vue'),
        meta: { clientTradingOnly: true },
      },
      {
        path: 'portfolio',
        component: () => import('../views/client/ClientPortfolioView.vue'),
        meta: { clientTradingOnly: true },
      },
      {
        path: 'otc',
        component: () => import('../views/client/ClientOtcPublicStocksView.vue'),
        meta: { clientTradingOnly: true },
      },
      {
        path: 'otc/offers',
        component: () => import('../views/client/ClientOtcOffersView.vue'),
        meta: { clientTradingOnly: true },
      },
      {
        path: 'otc/contracts',
        component: () => import('../views/client/ClientOtcContractsView.vue'),
        meta: { clientTradingOnly: true },
      },
      {
        path: 'funds',
        component: () => import('../views/client/ClientFundsView.vue'),
      },
      {
        path: 'funds/:id(\\d+)',
        component: () => import('../views/client/ClientFundDetailView.vue'),
      },
      {
        path: 'prenos',
        component: () => import('../views/client/ClientPrenosView.vue'),
      },
      {
        path: 'transfers',
        component: () => import('../views/client/ClientTransfersView.vue'),
      },
      {
        path: 'exchange',
        component: () => import('../views/client/ClientExchangeView.vue'),
      },
      {
        path: 'recipients',
        component: () => import('../views/client/ClientRecipientsView.vue'),
      },
      {
        path: 'payments',
        component: () => import('../views/client/ClientPaymentsView.vue'),
      },
      {
        path: 'payments/new',
        component: () => import('../views/client/ClientNewPaymentView.vue'),
      },
      {
        path: 'loans',
        component: () => import('../views/client/ClientLoansView.vue'),
      },
      {
        path: 'loans/new',
        component: () => import('../views/client/ClientNewLoanView.vue'),
      },
      {
        path: 'cards',
        component: () => import('../views/client/ClientCardsView.vue'),
      },
    ],
  },
]
