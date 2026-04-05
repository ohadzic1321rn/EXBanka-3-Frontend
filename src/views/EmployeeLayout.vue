<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { usePermissions } from '../composables/usePermissions'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const perms = usePermissions()

function logout() {
  auth.logout()
  router.push('/login')
}

const allNavItems = [
  { to: '/employees', label: 'Zaposleni', icon: 'E', perm: 'manageAll' },
  { to: '/clients', label: 'Klijenti', icon: 'C', perm: 'clients' },
  { to: '/accounts', label: 'Racuni', icon: 'R', perm: 'bankOps' },
  { to: '/accounts/new', label: 'Novi racun', icon: '+', perm: 'bankOps' },
  { to: '/securities', label: 'Hartije', icon: '$', perm: 'stockTrading' },
  { to: '/portfolio', label: 'Portfolio', icon: 'P', perm: 'stockTrading' },
  { to: '/actuaries', label: 'Aktuari', icon: 'A', perm: 'supervisor' },
  { to: '/orders', label: 'Nalozi', icon: 'N', perm: 'supervisor' },
  { to: '/loans/requests', label: 'Zahtevi kredita', icon: 'Z', perm: 'bankOps' },
  { to: '/loans', label: 'Krediti', icon: 'K', perm: 'bankOps' },
]

const navItems = computed(() =>
  allNavItems.filter((item) => {
    if (item.perm === 'manageAll') return perms.canManageAll()
    if (item.perm === 'clients') return perms.canManageClients()
    if (item.perm === 'bankOps') return perms.canBankOperations()
    if (item.perm === 'stockTrading') return perms.canStockTrading()
    if (item.perm === 'supervisor') return perms.isSupervisor()
    return true
  })
)

function isActive(to: string) {
  if (to === '/accounts/new') return route.path === to
  if (to === '/accounts') return route.path === '/accounts'
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <div class="emp-layout">
    <aside class="emp-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">EX<span>Banka</span></div>
        <div class="sidebar-subtitle">Portal zaposlenih</div>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="sidebar-link"
          :class="{ active: isActive(item.to) }"
        >
          <span class="sidebar-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-avatar">
            {{ auth.employee?.ime?.charAt(0) }}{{ auth.employee?.prezime?.charAt(0) }}
          </div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">{{ auth.employee?.ime }} {{ auth.employee?.prezime }}</div>
            <div class="sidebar-user-role">{{ auth.employee?.pozicija || 'Zaposleni' }}</div>
          </div>
        </div>
        <button class="sidebar-logout" @click="logout">Odjava</button>
      </div>
    </aside>

    <main class="emp-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.emp-layout {
  display: flex;
  min-height: 100vh;
}

.emp-sidebar {
  width: 260px;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 50;
}

.sidebar-header {
  padding: 28px 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-logo {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #fff;
}

.sidebar-logo span {
  color: #60a5fa;
}

.sidebar-subtitle {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-top: 4px;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-radius: 8px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.sidebar-link:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.06);
  text-decoration: none;
}

.sidebar-link.active {
  color: #fff;
  background: rgba(59, 130, 246, 0.2);
  box-shadow: inset 3px 0 0 #3b82f6;
}

.sidebar-icon {
  width: 20px;
  text-align: center;
  font-size: 16px;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.sidebar-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.sidebar-user-info {
  overflow: hidden;
}

.sidebar-user-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-user-role {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-logout {
  width: 100%;
  padding: 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.15s ease;
}

.sidebar-logout:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.2);
}

.emp-main {
  flex: 1;
  margin-left: 260px;
  background: #f8fafc;
  min-height: 100vh;
}
</style>
