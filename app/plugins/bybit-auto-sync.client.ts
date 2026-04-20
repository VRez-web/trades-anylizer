/**
 * Один раз за сессию вкладки: подтянуть закрытый PnL с Bybit в SQLite, затем обновить useFetch по приложению.
 * Без ключей в runtimeConfig запрос вернёт 503 — тихо игнорируем.
 */
export default defineNuxtPlugin(async () => {
  const flag = 'trades-analyzer-bybit-sync-session'
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(flag)) return
  try {
    await $fetch('/api/sync/bybit', {
      method: 'POST',
      body: { days: 365 },
    })
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(flag, '1')
    await refreshNuxtData()
  } catch {
    // нет NUXT_BYBIT_* ключей, сеть, ответ Bybit
  }
})
