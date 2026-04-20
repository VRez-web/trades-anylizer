<script setup lang="ts">
async function logout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    /* ignore */
  }
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <header class="top">
      <div class="inner">
        <NuxtLink to="/trades" class="brand">Trades Analyzer</NuxtLink>
        <nav class="nav">
          <NuxtLink to="/trades">Сделки</NuxtLink>
          <NuxtLink to="/system">Торговая система</NuxtLink>
          <div class="sub">
            <span class="sub-label">Журнал</span>
            <NuxtLink to="/journal/day">День</NuxtLink>
            <NuxtLink to="/journal/week">Неделя</NuxtLink>
            <NuxtLink to="/journal/month">Месяц</NuxtLink>
            <NuxtLink to="/journal/year">Год</NuxtLink>
          </div>
          <button type="button" class="btn btn-tiny logout-btn" @click="logout">Выйти</button>
        </nav>
      </div>
    </header>
    <main>
      <slot />
    </main>
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
</style>
