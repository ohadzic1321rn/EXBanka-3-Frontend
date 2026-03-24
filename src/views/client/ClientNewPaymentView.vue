<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { validateAccountNumber } from '../../utils/accountValidation'
import { useRouter } from 'vue-router'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useClientAccountStore } from '../../stores/clientAccount'
import { useRecipientStore } from '../../stores/recipient'
import { usePaymentStore } from '../../stores/payment'
import { SIFRE_PLACANJA } from '../../api/payment'
import { recipientApi } from '../../api/recipient'
import type { PaymentItem } from '../../api/payment'

const router = useRouter()
const clientAuthStore = useClientAuthStore()
const accountStore = useClientAccountStore()
const recipientStore = useRecipientStore()
const paymentStore = usePaymentStore()

const clientId = computed(() => String(clientAuthStore.client?.id ?? ''))

const step = ref<'form' | 'confirm' | 'verify' | 'success'>('form')

const form = ref({
  fromAccountId: '',
  recipientMode: 'saved' as 'saved' | 'manual',
  savedRecipientId: '',
  manualNaziv: '',
  manualBrojRacuna: '',
  iznos: '',
  sifraPlacanja: '289',
  pozivNaBroj: '',
  svrha: '',
})

const createdPayment = ref<PaymentItem | null>(null)
const verificationCode = ref('')
const verifyError = ref('')
const formError = ref('')
const verifySecondsLeft = ref(300)
const codeExpired = ref(false)
const failedAttempts = ref(0)
const maxAttempts = 3
let verifyTimerInterval: ReturnType<typeof setInterval> | null = null

const verifyCountdown = computed(() => {
  const m = Math.floor(verifySecondsLeft.value / 60)
  const s = verifySecondsLeft.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

function startVerifyTimer() {
  verifySecondsLeft.value = 300
  codeExpired.value = false
  failedAttempts.value = 0
  if (verifyTimerInterval) clearInterval(verifyTimerInterval)
  verifyTimerInterval = setInterval(() => {
    if (verifySecondsLeft.value > 0) {
      verifySecondsLeft.value--
    } else {
      codeExpired.value = true
      clearInterval(verifyTimerInterval!)
      verifyTimerInterval = null
    }
  }, 1000)
}

watch(step, (newStep) => {
  if (newStep === 'verify') {
    startVerifyTimer()
  } else {
    if (verifyTimerInterval) {
      clearInterval(verifyTimerInterval)
      verifyTimerInterval = null
    }
  }
})
const showLimitInfo = ref(false)
const addRecipientSuccess = ref(false)
const addingRecipient = ref(false)

const receiverBrojRacuna = computed(() => {
  if (form.value.recipientMode === 'saved') {
    const r = recipientStore.recipients.find(r => r.id === form.value.savedRecipientId)
    return r?.brojRacuna ?? ''
  }
  return form.value.manualBrojRacuna
})

const receiverNaziv = computed(() => {
  if (form.value.recipientMode === 'saved') {
    const r = recipientStore.recipients.find(r => r.id === form.value.savedRecipientId)
    return r?.naziv ?? ''
  }
  return form.value.manualNaziv
})

const fromAccount = computed(() =>
  accountStore.accounts.find(a => String(a.id) === form.value.fromAccountId) ?? null
)

const selectedSifra = computed(() =>
  SIFRE_PLACANJA.find(s => s.sifra === form.value.sifraPlacanja)
)

// Check if receiver is new (not in recipients list)
const isNewRecipient = computed(() => {
  if (!receiverBrojRacuna.value) return false
  return !recipientStore.recipients.some(r => r.brojRacuna === receiverBrojRacuna.value)
})

function goToConfirm() {
  formError.value = ''
  if (!form.value.fromAccountId) { formError.value = 'Izaberite račun platioca.'; return }
  if (!receiverBrojRacuna.value) { formError.value = 'Unesite broj računa primaoca.'; return }
  if (!validateAccountNumber(receiverBrojRacuna.value)) { formError.value = 'Broj računa primaoca je neispravan (checksum greška).'; return }
  if (!form.value.iznos || Number(form.value.iznos) <= 0) { formError.value = 'Unesite validan iznos.'; return }
  if (!form.value.svrha.trim()) { formError.value = 'Unesite svrhu plaćanja.'; return }
  step.value = 'confirm'
}

async function handleSubmit() {
  try {
    const payment = await paymentStore.createPayment({
      racunPosiljaocaId: Number(form.value.fromAccountId),
      racunPrimaocaBroj: receiverBrojRacuna.value,
      iznos: Number(form.value.iznos),
      sifraPlacanja: form.value.sifraPlacanja,
      pozivNaBroj: form.value.pozivNaBroj,
      svrha: form.value.svrha,
      recipientId: form.value.recipientMode === 'saved' && form.value.savedRecipientId
        ? Number(form.value.savedRecipientId) : undefined,
    })
    createdPayment.value = payment
    step.value = 'verify'
  } catch (e: any) {
    formError.value = e.response?.data?.message || 'Greška pri kreiranju plaćanja.'
    step.value = 'form'
  }
}

async function handleVerify() {
  if (!verificationCode.value || verificationCode.value.length !== 6) {
    verifyError.value = 'Unesite 6-cifreni verifikacioni kod.'
    return
  }
  verifyError.value = ''
  try {
    await paymentStore.verifyPayment(createdPayment.value!.id, verificationCode.value)
    step.value = 'success'
  } catch (e: any) {
    failedAttempts.value++
    verifyError.value = e.response?.data?.message || 'Neispravan verifikacioni kod.'
  }
}

async function addRecipient() {
  if (!receiverBrojRacuna.value) return
  addingRecipient.value = true
  try {
    await recipientApi.create(
      clientId.value,
      receiverNaziv.value || 'Primalac',
      receiverBrojRacuna.value,
    )
    addRecipientSuccess.value = true
    await recipientStore.fetchRecipients(clientId.value)
  } catch { /* ignore */ }
  addingRecipient.value = false
}

function startNew() {
  form.value = {
    fromAccountId: '', recipientMode: 'saved', savedRecipientId: '',
    manualNaziv: '', manualBrojRacuna: '', iznos: '', sifraPlacanja: '289',
    pozivNaBroj: '', svrha: '',
  }
  verificationCode.value = ''
  verifyError.value = ''
  formError.value = ''
  createdPayment.value = null
  addRecipientSuccess.value = false
  if (verifyTimerInterval) { clearInterval(verifyTimerInterval); verifyTimerInterval = null }
  verifySecondsLeft.value = 300
  codeExpired.value = false
  failedAttempts.value = 0
  step.value = 'form'
}

onUnmounted(() => {
  if (verifyTimerInterval) clearInterval(verifyTimerInterval)
})

onMounted(async () => {
  if (clientId.value) {
    await Promise.all([
      accountStore.fetchAccounts(clientId.value),
      recipientStore.fetchRecipients(clientId.value),
    ])
  }
})
</script>

<template>
  <div class="pay-page">
    <h1 class="pay-title">Novo plaćanje</h1>

    <div class="pay-card">

      <!-- FORM -->
      <div v-if="step === 'form'">
        <div class="pay-section-label">Nalog za plaćanje</div>

        <div class="pay-field">
          <label>Naziv primaoca</label>
          <div class="pay-toggle">
            <button :class="{ active: form.recipientMode === 'saved' }" @click="form.recipientMode = 'saved'">Iz liste</button>
            <button :class="{ active: form.recipientMode === 'manual' }" @click="form.recipientMode = 'manual'">Ručni unos</button>
          </div>
          <select v-if="form.recipientMode === 'saved'" v-model="form.savedRecipientId">
            <option value="">-- Izaberite primaoca --</option>
            <option v-for="r in recipientStore.recipients" :key="r.id" :value="r.id">
              {{ r.naziv }} — {{ r.brojRacuna }}
            </option>
          </select>
          <input v-else v-model="form.manualNaziv" placeholder="Naziv primaoca" />
        </div>

        <div class="pay-field">
          <label>Račun primaoca</label>
          <input
            v-if="form.recipientMode === 'manual'"
            v-model="form.manualBrojRacuna"
            placeholder="Broj računa primaoca (18 cifara)"
            maxlength="18"
          />
          <div v-else class="pay-readonly">
            {{ receiverBrojRacuna || 'Izaberite primaoca iz liste' }}
          </div>
        </div>

        <div class="pay-field">
          <label>
            Iznos
            <button class="pay-info-btn" @click="showLimitInfo = !showLimitInfo" title="Info o limitu">ⓘ</button>
          </label>
          <input v-model="form.iznos" type="number" min="0.01" step="0.01" placeholder="0.00" />
          <div v-if="showLimitInfo && fromAccount" class="pay-limit-info">
            <div>Raspoloživo: <strong>{{ fromAccount.raspolozivoStanje.toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }} {{ fromAccount.currencyKod }}</strong></div>
            <div>Dnevni limit: <strong>{{ fromAccount.dnevniLimit.toLocaleString('sr-RS') }} {{ fromAccount.currencyKod }}</strong></div>
            <div>Mesečni limit: <strong>{{ fromAccount.mesecniLimit.toLocaleString('sr-RS') }} {{ fromAccount.currencyKod }}</strong></div>
          </div>
        </div>

        <div class="pay-field">
          <label>Poziv na broj <span class="pay-optional">(opciono)</span></label>
          <input v-model="form.pozivNaBroj" placeholder="Poziv na broj" />
        </div>

        <div class="pay-field">
          <label>Šifra plaćanja</label>
          <select v-model="form.sifraPlacanja">
            <option v-for="s in SIFRE_PLACANJA" :key="s.sifra" :value="s.sifra">
              {{ s.sifra }} — {{ s.naziv }}
            </option>
          </select>
        </div>

        <div class="pay-field">
          <label>Svrha plaćanja</label>
          <input v-model="form.svrha" placeholder="Svrha plaćanja" />
        </div>

        <div class="pay-field">
          <label>Račun platioca</label>
          <select v-model="form.fromAccountId">
            <option value="">-- Izaberite račun --</option>
            <option v-for="acc in accountStore.accounts" :key="acc.id" :value="String(acc.id)">
              {{ acc.naziv || acc.brojRacuna }} ({{ acc.currencyKod }}) — {{ acc.raspolozivoStanje.toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }}
            </option>
          </select>
        </div>

        <div v-if="formError" class="pay-error">{{ formError }}</div>

        <button class="pay-btn pay-btn-primary" @click="goToConfirm">Nastavi</button>
      </div>

      <!-- CONFIRM -->
      <div v-else-if="step === 'confirm'">
        <div class="pay-section-label">Pregled naloga</div>
        <div class="pay-summary">
          <div class="pay-summary-row">
            <span>Primalac</span>
            <span>{{ receiverNaziv || receiverBrojRacuna }}</span>
          </div>
          <div class="pay-summary-row">
            <span>Račun primaoca</span>
            <span class="pay-mono">{{ receiverBrojRacuna }}</span>
          </div>
          <div class="pay-summary-row pay-summary-highlight">
            <span>Iznos</span>
            <span>{{ Number(form.iznos).toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }} {{ fromAccount?.currencyKod }}</span>
          </div>
          <div class="pay-summary-row">
            <span>Šifra plaćanja</span>
            <span>{{ form.sifraPlacanja }} — {{ selectedSifra?.naziv }}</span>
          </div>
          <div v-if="form.pozivNaBroj" class="pay-summary-row">
            <span>Poziv na broj</span>
            <span>{{ form.pozivNaBroj }}</span>
          </div>
          <div class="pay-summary-row">
            <span>Svrha</span>
            <span>{{ form.svrha }}</span>
          </div>
          <div class="pay-summary-row">
            <span>Sa računa</span>
            <span class="pay-mono">{{ fromAccount?.brojRacuna }}</span>
          </div>
        </div>
        <div v-if="formError" class="pay-error">{{ formError }}</div>
        <div class="pay-actions">
          <button class="pay-btn pay-btn-sec" @click="step = 'form'">Nazad</button>
          <button class="pay-btn pay-btn-primary" :disabled="paymentStore.loading" @click="handleSubmit">
            {{ paymentStore.loading ? 'Šaljem...' : 'Potvrdi' }}
          </button>
        </div>
      </div>

      <!-- VERIFY -->
      <div v-else-if="step === 'verify'">
        <div class="pay-section-label">Verifikacija</div>
        <p class="pay-subtitle">Unesite 6-cifreni verifikacioni kod za potvrdu plaćanja.</p>
        <div class="pay-countdown" :class="{ 'pay-countdown-expired': codeExpired }">
          <span v-if="!codeExpired">Kod ističe za: <strong>{{ verifyCountdown }}</strong></span>
          <span v-else>Kod je istekao.</span>
        </div>
        <div class="pay-attempts">
          Preostalo pokušaja: <strong>{{ maxAttempts - failedAttempts }}</strong>
        </div>
        <div class="pay-field">
          <input
            v-model="verificationCode"
            type="text" maxlength="6" placeholder="• • • • • •"
            class="pay-code-input"
            :disabled="codeExpired"
            @keyup.enter="handleVerify"
          />
        </div>
        <div v-if="verifyError" class="pay-error">{{ verifyError }}</div>
        <div class="pay-actions">
          <button class="pay-btn pay-btn-sec" @click="step = 'confirm'">Nazad</button>
          <button class="pay-btn pay-btn-primary" :disabled="verificationCode.length !== 6 || codeExpired" @click="handleVerify">
            Potvrdi kod
          </button>
        </div>
      </div>

      <!-- SUCCESS -->
      <div v-else class="pay-success">
        <div class="pay-success-icon">✓</div>
        <h2>Plaćanje uspešno!</h2>
        <p class="pay-subtitle">Vaša transakcija je uspešno realizovana.</p>

        <!-- Add recipient button if new -->
        <div v-if="isNewRecipient && !addRecipientSuccess" class="pay-add-recipient">
          <p>Primalac <strong>{{ receiverBrojRacuna }}</strong> nije u vašoj listi primalaca.</p>
          <div class="pay-field" v-if="form.recipientMode === 'manual'">
            <input v-model="form.manualNaziv" placeholder="Naziv primaoca" style="margin-bottom:8px" />
          </div>
          <button class="pay-btn pay-btn-outline" :disabled="addingRecipient" @click="addRecipient">
            {{ addingRecipient ? 'Dodajem...' : '+ Dodaj primaoca' }}
          </button>
        </div>
        <div v-if="addRecipientSuccess" class="pay-recipient-added">
          ✓ Primalac dodat u listu primalaca plaćanja.
        </div>

        <div class="pay-actions" style="margin-top:24px">
          <button class="pay-btn pay-btn-sec" @click="router.push('/client/payments')">Pregled plaćanja</button>
          <button class="pay-btn pay-btn-primary" @click="startNew">Novo plaćanje</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pay-page { padding: 32px; max-width: 680px; margin: 0 auto; }
.pay-title { font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 24px; }
.pay-card {
  background: #fff; border-radius: 16px; padding: 32px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
  border: 1px solid #e2e8f0;
}
.pay-section-label {
  font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
  color: #64748b; margin-bottom: 20px; padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}
.pay-subtitle { color: #64748b; font-size: 14px; margin-bottom: 20px; }

.pay-field { margin-bottom: 18px; display: flex; flex-direction: column; gap: 6px; }
.pay-field label {
  font-size: 13px; font-weight: 600; color: #374151;
  display: flex; align-items: center; gap: 6px;
}
.pay-optional { font-weight: 400; color: #94a3b8; font-size: 12px; }
.pay-field input, .pay-field select {
  padding: 11px 14px; border: 1px solid #d1d5db; border-radius: 10px;
  font-size: 14px; background: #fff; transition: border-color 0.15s;
}
.pay-field input:focus, .pay-field select:focus { border-color: #3b82f6; outline: none; }
.pay-readonly {
  padding: 11px 14px; border: 1px solid #e2e8f0; border-radius: 10px;
  background: #f8fafc; color: #64748b; font-size: 14px; font-family: 'SF Mono', monospace;
}
.pay-mono { font-family: 'SF Mono', monospace; font-size: 13px; }

.pay-toggle { display: flex; gap: 0; margin-bottom: 8px; }
.pay-toggle button {
  flex: 1; padding: 8px; font-size: 13px; font-weight: 500;
  border: 1px solid #d1d5db; background: #f8fafc; color: #64748b; cursor: pointer;
  transition: all 0.15s;
}
.pay-toggle button:first-child { border-radius: 8px 0 0 8px; }
.pay-toggle button:last-child { border-radius: 0 8px 8px 0; border-left: none; }
.pay-toggle button.active { background: #2563eb; color: #fff; border-color: #2563eb; }

.pay-info-btn {
  background: none; border: none; color: #3b82f6; font-size: 16px;
  cursor: pointer; padding: 0; line-height: 1;
}
.pay-limit-info {
  padding: 10px 14px; background: #eff6ff; border-radius: 8px;
  font-size: 13px; color: #1e40af; display: flex; flex-direction: column; gap: 4px;
}

.pay-error {
  padding: 10px 14px; background: #fef2f2; color: #dc2626;
  border-radius: 8px; font-size: 13px; margin-bottom: 16px;
}

.pay-btn {
  padding: 12px 24px; border-radius: 10px; font-size: 15px; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.15s;
}
.pay-btn-primary { background: #2563eb; color: #fff; width: 100%; }
.pay-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.pay-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.pay-btn-sec { background: #f1f5f9; color: #475569; }
.pay-btn-sec:hover { background: #e2e8f0; }
.pay-btn-outline {
  background: transparent; color: #2563eb; border: 1px solid #2563eb;
  padding: 10px 20px; font-size: 14px;
}
.pay-btn-outline:hover:not(:disabled) { background: #eff6ff; }

.pay-actions { display: flex; gap: 12px; margin-top: 20px; }
.pay-actions .pay-btn-primary { flex: 1; }

/* Summary */
.pay-summary { display: flex; flex-direction: column; margin-bottom: 4px; }
.pay-summary-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;
}
.pay-summary-row:last-child { border-bottom: none; }
.pay-summary-row span:first-child { color: #64748b; }
.pay-summary-row span:last-child { font-weight: 500; color: #0f172a; }
.pay-summary-highlight span:last-child { font-size: 18px; font-weight: 700; color: #2563eb; }

/* Countdown */
.pay-countdown {
  text-align: center; font-size: 14px; color: #475569;
  margin-bottom: 16px; padding: 8px 14px;
  background: #f8fafc; border-radius: 8px;
}
.pay-countdown strong { color: #2563eb; font-size: 16px; }
.pay-countdown-expired { background: #fef2f2; color: #dc2626; }
.pay-attempts { text-align: center; font-size: 13px; color: #64748b; margin-bottom: 16px; }
.pay-attempts strong { color: #0f172a; }

/* Code input */
.pay-code-input {
  text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 12px;
  padding: 16px !important; font-family: 'SF Mono', monospace;
}

/* Success */
.pay-success { text-align: center; padding: 20px 0; }
.pay-success-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff; font-size: 32px; display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}
.pay-success h2 { font-size: 22px; color: #0f172a; margin-bottom: 4px; }

.pay-add-recipient {
  margin-top: 20px; padding: 16px; background: #fffbeb; border: 1px solid #fde68a;
  border-radius: 10px; font-size: 14px; color: #92400e;
}
.pay-add-recipient .pay-btn-outline { margin-top: 10px; }

.pay-recipient-added {
  margin-top: 16px; padding: 12px 16px; background: #dcfce7;
  border-radius: 8px; color: #166534; font-size: 14px; font-weight: 500;
}
</style>
