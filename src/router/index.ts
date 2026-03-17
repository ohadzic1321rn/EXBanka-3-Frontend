import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useClientAuthStore } from '../stores/clientAuth'
import { clientRoutes } from './clientRoutes'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/employees' },
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
      path: '/employees',
      component: () => import('../views/EmployeeListView.vue'),
    },
    {
      path: '/clients',
      component: () => import('../views/ClientManagementView.vue'),
    },
    {
      path: '/accounts',
      component: () => import('../views/AccountPortalView.vue'),
    },
    {
      path: '/accounts/new',
      component: () => import('../views/CreateAccountView.vue'),
    },
    ...clientRoutes,
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const clientAuth = useClientAuthStore()

  // Client routes: redirect to client login if not authenticated as client
  if (to.meta.clientOnly && !clientAuth.isLoggedIn) return '/client/login'
  if (to.path === '/client/login' && clientAuth.isLoggedIn) return '/client/dashboard'

  // Employee routes: skip for client-public routes
  if (to.meta.clientPublic) return

  if (!to.meta.public && !auth.isLoggedIn) return '/login'
  if (to.path === '/login' && auth.isLoggedIn) return '/employees'
})

export default router
