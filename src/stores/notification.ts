import { defineStore } from 'pinia'
import { ref } from 'vue'
import { notificationApi, type AppNotification } from '../api/notification'

const POLL_INTERVAL_MS = 30_000

export const useNotificationStore = defineStore('notification', () => {
  const items = ref<AppNotification[]>([])
  const unread = ref(0)
  const loading = ref(false)
  const error = ref('')

  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function fetchUnreadCount() {
    try {
      const res = await notificationApi.unreadCount()
      unread.value = res.data?.unread ?? 0
    } catch {
      // silent — badge just keeps its last value
    }
  }

  async function fetchAll() {
    loading.value = true
    error.value = ''
    try {
      const res = await notificationApi.list()
      items.value = res.data ?? []
      unread.value = items.value.filter((n) => !n.is_read).length
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Greška pri učitavanju obaveštenja.'
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function markRead(id: number) {
    try {
      await notificationApi.markRead(id)
      const n = items.value.find((i) => i.id === id)
      if (n && !n.is_read) {
        n.is_read = true
        unread.value = Math.max(0, unread.value - 1)
      }
    } catch {
      // ignore — next poll reconciles
    }
  }

  async function markAllRead() {
    try {
      await notificationApi.markAllRead()
      items.value.forEach((n) => (n.is_read = true))
      unread.value = 0
    } catch {
      // ignore
    }
  }

  async function remove(id: number) {
    try {
      await notificationApi.remove(id)
      const n = items.value.find((i) => i.id === id)
      if (n && !n.is_read) unread.value = Math.max(0, unread.value - 1)
      items.value = items.value.filter((i) => i.id !== id)
    } catch {
      // ignore
    }
  }

  // startPolling kicks off a lightweight unread-count poll. Safe to call more
  // than once — it never stacks timers.
  function startPolling() {
    fetchUnreadCount()
    if (pollTimer) return
    pollTimer = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    items.value = []
    unread.value = 0
  }

  return {
    items,
    unread,
    loading,
    error,
    fetchUnreadCount,
    fetchAll,
    markRead,
    markAllRead,
    remove,
    startPolling,
    stopPolling,
  }
})
