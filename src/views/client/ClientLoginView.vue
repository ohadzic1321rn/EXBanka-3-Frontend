<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useClientAuthStore } from '../../stores/clientAuth'

const router = useRouter()
const clientAuth = useClientAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = 'Please enter email and password.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await clientAuth.login(email.value, password.value)
    router.push('/client/dashboard')
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Invalid credentials.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1>EXBanka</h1>
      <h2>Client Portal</h2>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="your@email.com" required />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="Your password" required />
        </div>

        <p v-if="error" class="global-error">{{ error }}</p>

        <button type="submit" class="btn-primary" :disabled="loading" style="width:100%;padding:10px">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>
