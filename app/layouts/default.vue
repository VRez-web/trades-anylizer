<script setup lang="ts">
const bybitSync = useBybitSyncLoading()
const syncingNow = ref(false)

async function logout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    /* ignore */
  }
  await navigateTo('/login')
}

async function runBybitSync() {
  if (syncingNow.value || bybitSync.value.active) return
  syncingNow.value = true
  bybitSync.value.active = true
  try {
    await $fetch('/api/sync/bybit', {
      method: 'POST',
      body: { days: 365 },
    })
    await refreshNuxtData()
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    alert(msg || 'Не удалось запустить синк с Bybit')
  } finally {
    bybitSync.value.active = false
    syncingNow.value = false
  }
}
</script>

<template>
  <div>
    <header class="top">
      <div class="inner">
        <NuxtLink to="/trades" class="brand">Trades Analyzer</NuxtLink>
        <nav class="nav">
          <NuxtLink to="/trades">Сделки</NuxtLink>
          <NuxtLink to="/trades/list">Список</NuxtLink>
          <NuxtLink to="/system">Торговая система</NuxtLink>
          <div class="sub">
            <span class="sub-label">Журнал</span>
            <NuxtLink to="/journal/day">День</NuxtLink>
            <NuxtLink to="/journal/week">Неделя</NuxtLink>
            <NuxtLink to="/journal/month">Месяц</NuxtLink>
            <NuxtLink to="/journal/year">Год</NuxtLink>
          </div>
          <button
            type="button"
            class="btn btn-tiny"
            :disabled="syncingNow || bybitSync.active"
            @click="runBybitSync"
          >
            Синк Bybit
          </button>
          <button type="button" class="btn btn-tiny logout-btn" @click="logout">Выйти</button>
        </nav>
      </div>
    </header>
    <main>
      <slot />
    </main>

    <Teleport to="body">
      <div v-if="bybitSync.active" class="sync-overlay" role="status" aria-live="polite">
        <div class="sync-panel">
          <div class="sync-spinner" aria-hidden="true" />
          <p class="sync-title">Синхронизация с Bybit</p>
          <p class="sync-sub muted">Ждём загрузку закрытого PnL…</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.top {
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.65rem 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
.brand {
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
}
.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: center;
  font-size: 0.9rem;
}
.nav a.router-link-active {
  color: var(--text);
  text-decoration: underline;
  text-underline-offset: 4px;
}
.sub {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  align-items: center;
  padding-left: 0.75rem;
  border-left: 1px solid var(--border);
}
.sub-label {
  color: var(--muted);
  font-size: 0.8rem;
}
.logout-btn {
  margin-left: auto;
  font-size: 0.8rem;
  padding: 0.3rem 0.55rem;
}
@media (max-width: 640px) {
  .logout-btn {
    margin-left: 0;
  }
}
.sync-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
}
.sync-panel {
  min-width: min(320px, 90vw);
  padding: 1.35rem 1.5rem;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.18);
  text-align: center;
}
.sync-title {
  margin: 0.75rem 0 0.2rem;
  font-weight: 600;
  font-size: 1rem;
}
.sync-sub {
  margin: 0;
  font-size: 0.875rem;
}
.sync-spinner {
  width: 2.25rem;
  height: 2.25rem;
  margin: 0 auto;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: sync-spin 0.75s linear infinite;
}
@keyframes sync-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
