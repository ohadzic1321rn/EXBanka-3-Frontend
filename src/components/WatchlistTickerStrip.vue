<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useWatchlistStore } from '../stores/watchlist'

const watchlistStore = useWatchlistStore()

const POLL_INTERVAL_MS = 30_000

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await watchlistStore.fetchAllTracked()
  pollTimer = setInterval(async () => {
    await watchlistStore.fetchAllTracked()
  }, POLL_INTERVAL_MS)
})

onUnmounted(() => {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

function fmtPrice(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtChange(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}
</script>

<template>
  <div v-if="watchlistStore.allTrackedItems.length > 0" class="ticker-strip">
    <div class="ticker-scroll">
      <div
        v-for="item in watchlistStore.allTrackedItems"
        :key="item.ticker"
        class="ticker-chip"
      >
        <span class="chip-ticker">{{ item.ticker }}</span>
        <span class="chip-price">{{ fmtPrice(item.price) }}</span>
        <span
          class="chip-change"
          :class="item.change >= 0 ? 'chip-up' : 'chip-down'"
        >{{ fmtChange(item.change) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticker-strip {
  width: 100%;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 16px;
  overflow: hidden;
  height: 40px;
  display: flex;
  align-items: center;
}

.ticker-scroll {
  display: flex;
  align-items: center;
  gap: 24px;
  overflow-x: auto;
  scrollbar-width: none;
}

.ticker-scroll::-webkit-scrollbar {
  display: none;
}

.ticker-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.chip-ticker {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chip-price {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.chip-change {
  font-size: 12px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
}

.chip-up {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.chip-down {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}
</style>
