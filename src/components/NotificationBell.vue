<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '../stores/notification'
import type { AppNotification } from '../api/notification'

const props = withDefaults(defineProps<{ basePath?: string }>(), { basePath: '/client' })

const store = useNotificationStore()
const router = useRouter()
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
  if (open.value) store.fetchAll()
}

function onClickOutside(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false
  }
}

async function onClickNotification(n: AppNotification) {
  if (!n.is_read) await store.markRead(n.id)
  if (n.link) {
    open.value = false
    router.push(`${props.basePath}${n.link}`).catch(() => {})
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('sr-RS', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

onMounted(() => {
  store.startPolling()
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div ref="rootEl" class="notif-bell">
    <button class="notif-trigger" :class="{ active: open }" @click="toggle" aria-label="Obaveštenja">
      <span class="notif-icon">🔔</span>
      <span v-if="store.unread > 0" class="notif-badge">{{ store.unread > 99 ? '99+' : store.unread }}</span>
    </button>

    <div v-if="open" class="notif-dropdown">
      <div class="notif-header">
        <span>Obaveštenja</span>
        <button v-if="store.unread > 0" class="notif-mark-all" @click="store.markAllRead()">
          Označi sve kao pročitano
        </button>
      </div>

      <div class="notif-list">
        <div v-if="store.loading" class="notif-empty">Učitavanje…</div>
        <div v-else-if="store.items.length === 0" class="notif-empty">Nema obaveštenja.</div>
        <button
          v-for="n in store.items"
          :key="n.id"
          class="notif-item"
          :class="{ unread: !n.is_read }"
          @click="onClickNotification(n)"
        >
          <div class="notif-item-top">
            <span class="notif-item-title">{{ n.title }}</span>
            <span class="notif-item-time">{{ formatTime(n.created_at) }}</span>
          </div>
          <div class="notif-item-body">{{ n.body }}</div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notif-bell { position: relative; }

.notif-trigger {
  position: relative; width: 40px; height: 40px; border-radius: 10px;
  background: #fff; border: 1px solid #e2e8f0; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; transition: all 0.15s ease;
}
.notif-trigger:hover, .notif-trigger.active { background: #f1f5f9; border-color: #cbd5e1; }

.notif-badge {
  position: absolute; top: -6px; right: -6px;
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
  background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; line-height: 1;
}

.notif-dropdown {
  position: absolute; top: 48px; right: 0; width: 360px; max-height: 460px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15,23,42,0.16); z-index: 100;
  display: flex; flex-direction: column; overflow: hidden;
}

.notif-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid #f1f5f9;
  font-size: 14px; font-weight: 700; color: #0f172a;
}
.notif-mark-all {
  background: none; border: none; cursor: pointer;
  color: #3b82f6; font-size: 12px; font-weight: 600;
}
.notif-mark-all:hover { text-decoration: underline; }

.notif-list { overflow-y: auto; }
.notif-empty { padding: 28px 16px; text-align: center; color: #94a3b8; font-size: 13px; }

.notif-item {
  width: 100%; text-align: left; cursor: pointer;
  padding: 12px 16px; border: none; background: #fff;
  border-bottom: 1px solid #f1f5f9; transition: background 0.12s;
}
.notif-item:hover { background: #f8fafc; }
.notif-item.unread { background: #eff6ff; }
.notif-item.unread:hover { background: #dbeafe; }

.notif-item-top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
.notif-item-title { font-size: 13px; font-weight: 600; color: #0f172a; }
.notif-item-time { font-size: 11px; color: #94a3b8; white-space: nowrap; }
.notif-item-body { font-size: 12px; color: #475569; line-height: 1.4; }
</style>
