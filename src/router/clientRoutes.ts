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
    ],
  },
]
