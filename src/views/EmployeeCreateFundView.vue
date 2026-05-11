<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fundApi } from '../api/fund'

const router = useRouter()

const naziv = ref('')
const opis = ref('')
const minimalniUlog = ref<number>(10000)
const submitting = ref(false)
const errorMsg = ref('')

async function submit() {
  errorMsg.value = ''
  if (!naziv.value.trim()) { errorMsg.value = 'Unesite naziv fonda.'; return }
  if (minimalniUlog.value <= 0) { errorMsg.value = 'Minimalni ulog mora biti pozitivan.'; return }

  submitting.value = true
  try {
    const res = await fundApi.create({
      naziv: naziv.value.trim(),
      opis: opis.value.trim(),
      minimalniUlog: minimalniUlog.value,
    })
    const id = res.data?.fund?.id
    if (id) router.push(`/funds/${id}`)
    else router.push('/funds')
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Greska pri kreiranju fonda.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="create-fund">
    <button class="back-btn" @click="router.push('/funds')">&larr; Nazad</button>
    <header><h1>Kreiranje investicionog fonda</h1></header>

    <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>

    <form class="card" @submit.prevent="submit">
      <div class="field">
        <label>Naziv fonda <span class="req">*</span></label>
        <input type="text" v-model="naziv" placeholder="npr. EXBanka Plavi Fond" />
        <p class="hint">Mora biti unikatan.</p>
      </div>
      <div class="field">
        <label>Kratak opis</label>
        <textarea v-model="opis" rows="4" placeholder="Kratak opis investicione strategije fonda..."></textarea>
      </div>
      <div class="field">
        <label>Minimalni iznos ulaganja (RSD) <span class="req">*</span></label>
        <input type="number" v-model.number="minimalniUlog" min="0" step="0.01" />
      </div>

      <div class="hint">
        Po zavrsetku fond ce odmah biti vidljiv na Discovery stranici. Banka ce
        automatski kreirati dinarski racun namenjen ovom fondu.
      </div>

      <div class="actions">
        <button type="button" class="btn-secondary" :disabled="submitting" @click="router.push('/funds')">Otkazi</button>
        <button type="submit" class="btn-primary" :disabled="submitting">{{ submitting ? 'Slanje...' : 'Kreiraj fond' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.create-fund { padding: 32px; max-width: 720px; margin: 0 auto; }
.back-btn { background: none; border: none; color: #2563eb; font-size: 14px; cursor: pointer; margin-bottom: 16px; }
header h1 { margin: 0 0 16px; color: #0f172a; }
.card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 2px 12px rgba(15,23,42,0.05); }
.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
.field label { font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
.field input, .field textarea { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; font-family: inherit; }
.req { color: #dc2626; }
.hint { color: #64748b; font-size: 13px; margin: 4px 0 8px; }
.actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
.btn-primary { padding: 10px 22px; border: none; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 700; cursor: pointer; }
.btn-secondary { padding: 10px 22px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #374151; font-weight: 600; cursor: pointer; }
.error-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 10px; padding: 10px 14px; color: #b91c1c; margin-bottom: 14px; }
</style>
