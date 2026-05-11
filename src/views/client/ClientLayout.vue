<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, RouterLink, useRoute } from 'vue-router'
import { useClientAuthStore } from '../../stores/clientAuth'

const router = useRouter()
const route = useRoute()
const clientAuth = useClientAuthStore()
const paymentsOpen = ref(true)
const canAccessMarket = computed(() => clientAuth.hasPermission('clientTrading'))

function logout() {
  clientAuth.logout()
  router.push('/client/login')
}

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

function isPaymentSection() {
  return route.path.startsWith('/client/payments') ||
    route.path.startsWith('/client/prenos') ||
    route.path.startsWith('/client/recipients')
}
</script>

<template>
  <div class="client-layout">
    <aside class="client-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">EX<span>Banka</span></div>
        <div class="sidebar-subtitle">Klijentski portal</div>
      </div>

      <nav class="sidebar-nav">
        <RouterLink to="/client/dashboard" class="sidebar-link" :class="{ active: isActive('/client/dashboard') }">
          <span class="sidebar-icon">[]</span><span>Dashboard</span>
        </RouterLink>

        <RouterLink to="/client/accounts" class="sidebar-link" :class="{ active: isActive('/client/accounts') }">
          <span class="sidebar-icon">o</span><span>Racuni</span>
        </RouterLink>

        <RouterLink v-if="canAccessMarket" to="/client/securities" class="sidebar-link" :class="{ active: isActive('/client/securities') }">
          <span class="sidebar-icon">%</span><span>Hartije</span>
        </RouterLink>

        <RouterLink v-if="canAccessMarket" to="/client/portfolio" class="sidebar-link" :class="{ active: isActive('/client/portfolio') }">
          <span class="sidebar-icon">$</span><span>Portfolio</span>
        </RouterLink>

        <RouterLink v-if="canAccessMarket" to="/client/otc" class="sidebar-link" :class="{ active: isActive('/client/otc') }">
          <span class="sidebar-icon">OT</span><span>OTC portal</span>
        </RouterLink>

        <RouterLink v-if="canAccessMarket" to="/client/otc/offers" class="sidebar-sublink" :class="{ active: isActive('/client/otc/offers') }">
          OTC ponude
        </RouterLink>

        <RouterLink to="/client/funds" class="sidebar-link" :class="{ active: isActive('/client/funds') }">
          <span class="sidebar-icon">F</span><span>Fondovi</span>
        </RouterLink>

        <RouterLink to="/client/transfers" class="sidebar-link" :class="{ active: isActive('/client/transfers') }">
          <span class="sidebar-icon">&lt;&gt;</span><span>Transferi</span>
        </RouterLink>

        <RouterLink to="/client/exchange" class="sidebar-link" :class="{ active: isActive('/client/exchange') }">
          <span class="sidebar-icon">@</span><span>Menjacnica</span>
        </RouterLink>

        <RouterLink to="/client/loans" class="sidebar-link" :class="{ active: isActive('/client/loans') }">
          <span class="sidebar-icon">#</span><span>Krediti</span>
        </RouterLink>

        <RouterLink to="/client/cards" class="sidebar-link" :class="{ active: isActive('/client/cards') }">
          <span class="sidebar-icon">*</span><span>Kartice</span>
        </RouterLink>

        <button class="sidebar-link sidebar-group-btn" :class="{ active: isPaymentSection() }" @click="paymentsOpen = !paymentsOpen">
          <span class="sidebar-icon">+</span>
          <span style="flex:1;text-align:left">Placanja</span>
          <span class="sidebar-arrow" :class="{ open: paymentsOpen }">&gt;</span>
        </button>

        <div v-if="paymentsOpen" class="sidebar-submenu">
          <RouterLink to="/client/payments/new" class="sidebar-sublink" :class="{ active: isActive('/client/payments/new') }">
            Novo placanje
          </RouterLink>
          <RouterLink to="/client/prenos" class="sidebar-sublink" :class="{ active: isActive('/client/prenos') }">
            Prenos
          </RouterLink>
          <RouterLink to="/client/recipients" class="sidebar-sublink" :class="{ active: isActive('/client/recipients') }">
            Primaoci placanja
          </RouterLink>
          <RouterLink to="/client/payments" class="sidebar-sublink" :class="{ active: route.path === '/client/payments' }">
            Pregled placanja
          </RouterLink>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-avatar">
            {{ clientAuth.client?.ime?.charAt(0) }}{{ clientAuth.client?.prezime?.charAt(0) }}
          </div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">{{ clientAuth.client?.ime }} {{ clientAuth.client?.prezime }}</div>
            <div class="sidebar-user-email">{{ clientAuth.client?.email }}</div>
          </div>
        </div>
        <button class="sidebar-logout" @click="logout">Odjava</button>
      </div>
    </aside>

    <main class="client-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.client-layout { display: flex; min-height: 100vh; }

.client-sidebar {
  width: 260px;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  color: #fff; display: flex; flex-direction: column;
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 50;
}

.sidebar-header { padding: 28px 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.sidebar-logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
.sidebar-logo span { color: #60a5fa; }
.sidebar-subtitle { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }

.sidebar-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }

.sidebar-link {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 16px; border-radius: 8px;
  color: #94a3b8; text-decoration: none;
  font-size: 14px; font-weight: 500; transition: all 0.15s ease;
}
.sidebar-link:hover { color: #e2e8f0; background: rgba(255,255,255,0.06); text-decoration: none; }
.sidebar-link.active { color: #fff; background: rgba(59,130,246,0.2); box-shadow: inset 3px 0 0 #3b82f6; }
.sidebar-icon { width: 20px; text-align: center; font-size: 16px; }

.sidebar-group-btn {
  width: 100%; border: none; cursor: pointer; background: none;
  font-family: inherit;
}
.sidebar-arrow {
  font-size: 14px; transition: transform 0.2s; color: #64748b;
}
.sidebar-arrow.open { transform: rotate(90deg); }

.sidebar-submenu {
  display: flex; flex-direction: column; gap: 1px;
  padding-left: 20px; margin-bottom: 4px;
}
.sidebar-sublink {
  display: block; padding: 8px 16px 8px 28px; border-radius: 6px;
  color: #64748b; text-decoration: none; font-size: 13px; font-weight: 500;
  transition: all 0.15s; border-left: 2px solid transparent;
}
.sidebar-sublink:hover { color: #cbd5e1; background: rgba(255,255,255,0.04); text-decoration: none; }
.sidebar-sublink.active { color: #93c5fd; border-left-color: #3b82f6; background: rgba(59,130,246,0.1); }

.sidebar-footer { padding: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
.sidebar-user { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.sidebar-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; flex-shrink: 0;
}
.sidebar-user-info { overflow: hidden; }
.sidebar-user-name { font-size: 13px; font-weight: 600; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-user-email { font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-logout {
  width: 100%; padding: 8px; border-radius: 6px;
  background: rgba(255,255,255,0.06); color: #94a3b8; font-size: 13px;
  border: 1px solid rgba(255,255,255,0.08); transition: all 0.15s ease;
}
.sidebar-logout:hover { background: rgba(239,68,68,0.15); color: #fca5a5; border-color: rgba(239,68,68,0.2); }
.client-main { flex: 1; margin-left: 260px; background: #f8fafc; min-height: 100vh; }
</style>
