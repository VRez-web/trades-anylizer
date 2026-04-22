/**
 * Подтягиваем закрытый PnL с Bybit в БД и обновляем данные.
 * Раньше плагин выполнялся только один раз при старте: если первый экран был /login,
 * синк пропускался и после входа больше не запускался — исправлено через router.afterEach.
 * Не чаще одного успешного запуска за сессию вкладки (sessionStorage), без параллельных запросов.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const flag = 'trades-analyzer-bybit-sync-session'
  const loading = useBybitSyncLoading()
  const router = useRouter()

  let inFlight = false

  async function tryOncePerSessionSync() {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(flag)) return
    if (inFlight) return
    inFlight = true
    try {
      const me = await $fetch<{ authed: boolean }>('/api/auth/me')
      if (!me.authed) return

      loading.value.active = true
      try {
        await $fetch('/api/sync/bybit', {
          method: 'POST',
          body: { days: 365 },
        })
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(flag, '1')
        await refreshNuxtData()
      } catch (e) {
        if (import.meta.dev) console.warn('[bybit-auto-sync]', e)
      } finally {
        loading.value.active = false
      }
    } catch (e) {
      if (import.meta.dev) console.warn('[bybit-auto-sync] /api/auth/me', e)
    } finally {
      inFlight = false
    }
  }

  router.afterEach(() => {
    void tryOncePerSessionSync()
  })

  nuxtApp.hook('app:mounted', () => {
    void tryOncePerSessionSync()
  })
})
