import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useClientAuthStore } from '../stores/clientAuth'
import { clientRoutes } from './clientRoutes'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/clients' },
    {
      path: '/login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/activate/:token',
      component: () => import('../views/ActivateAccountView.vue'),
      meta: { public: true },
    },
    {
      path: '/password-reset',
      component: () => import('../views/RequestPasswordResetView.vue'),
      meta: { public: true },
    },
    {
      path: '/reset-password/:token',
      component: () => import('../views/ResetPasswordView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('../views/EmployeeLayout.vue'),
      children: [
        {
          path: 'employees',
          component: () => import('../views/EmployeeListView.vue'),
          meta: { adminOnly: true },
        },
        {
          path: 'clients',
          component: () => import('../views/ClientManagementView.vue'),
        },
        {
          path: 'accounts',
          component: () => import('../views/AccountPortalView.vue'),
        },
        {
          path: 'accounts/new',
          component: () => import('../views/CreateAccountView.vue'),
        },
        {
          path: 'securities',
          component: () => import('../views/EmployeeSecuritiesView.vue'),
          meta: { employeeTradingOnly: true },
        },
        {
          path: 'securities/:ticker',
          component: () => import('../views/EmployeeSecurityDetailsView.vue'),
          meta: { employeeTradingOnly: true },
        },
        {
          path: 'portfolio',
          component: () => import('../views/EmployeePortfolioView.vue'),
          meta: { employeeTradingOnly: true },
        },
        {
          path: 'actuaries',
          component: () => import('../views/EmployeeActuariesManagementView.vue'),
          meta: { employeeSupervisorOnly: true },
        },
        {
          path: 'orders',
          component: () => import('../views/EmployeeOrderReviewView.vue'),
          meta: { employeeSupervisorOnly: true },
        },
        {
          path: 'loans/requests',
          component: () => import('../views/LoanRequestsView.vue'),
        },
        {
          path: 'loans',
          component: () => import('../views/LoansView.vue'),
        },
      ],
    },
    ...clientRoutes,
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const clientAuth = useClientAuthStore()

  // Client routes
  if (to.meta.clientOnly && !clientAuth.isLoggedIn) return '/client/login'
  if (to.path === '/client/login' && clientAuth.isLoggedIn) return '/client/dashboard'
  if (to.meta.clientTradingOnly && !clientAuth.hasPermission('clientTrading')) {
    return '/client/dashboard'
  }
  if (to.meta.clientOnly || to.meta.clientPublic) return

  // Employee routes
  if (!to.meta.public && !auth.isLoggedIn) return '/login'
  if (to.path === '/login' && auth.isLoggedIn) return '/clients'
  if (to.meta.employeeTradingOnly && !auth.hasPermission('employeeAgent')) return '/clients'
  if (to.meta.employeeSupervisorOnly && !auth.hasPermission('employeeSupervisor')) return '/clients'
  if (to.meta.adminOnly && !auth.hasPermission('employeeAdmin')) return '/clients'
})

export default router
