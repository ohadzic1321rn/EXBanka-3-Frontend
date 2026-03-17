<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import NavBar from './components/NavBar.vue'

const route = useRoute()
const auth = useAuthStore()

const publicRoutes = ['/login', '/activate', '/password-reset', '/reset-password']
const isPublic = () =>
  publicRoutes.some(p => route.path.startsWith(p)) || route.path.startsWith('/client')
</script>

<template>
  <div id="app">
    <NavBar v-if="auth.isLoggedIn && !isPublic()" />
    <RouterView />
  </div>
</template>
