<script setup lang="ts">
import { useRouter, RouterLink } from 'vue-router'
import { useClientAuthStore } from '../stores/clientAuth'

const router = useRouter()
const clientAuth = useClientAuthStore()

function logout() {
  clientAuth.logout()
  router.push('/client/login')
}
</script>

<template>
  <nav class="navbar">
    <div style="display:flex;align-items:center;gap:24px">
      <span class="navbar-brand">EXBanka</span>
      <RouterLink to="/client/dashboard" style="color:#93c5fd;font-size:14px;text-decoration:none" active-class="navbar-nav-active">Dashboard</RouterLink>
      <RouterLink to="/client/accounts" style="color:#93c5fd;font-size:14px;text-decoration:none" active-class="navbar-nav-active">Računi</RouterLink>
      <RouterLink to="/client/transfers" style="color:#93c5fd;font-size:14px;text-decoration:none" active-class="navbar-nav-active">Transferi</RouterLink>
      <RouterLink to="/client/exchange" style="color:#93c5fd;font-size:14px;text-decoration:none" active-class="navbar-nav-active">Menjačnica</RouterLink>
      <RouterLink to="/client/recipients" style="color:#93c5fd;font-size:14px;text-decoration:none" active-class="navbar-nav-active">Primaoci</RouterLink>
      <RouterLink to="/client/payments" style="color:#93c5fd;font-size:14px;text-decoration:none" active-class="navbar-nav-active">Plaćanja</RouterLink>
    </div>
    <div class="navbar-right">
      <span class="navbar-user">
        {{ clientAuth.client?.ime }} {{ clientAuth.client?.prezime }}
      </span>
      <button class="navbar-logout" @click="logout">Odjava</button>
    </div>
  </nav>
</template>
