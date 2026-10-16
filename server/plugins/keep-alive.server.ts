const INTERVAL_MS = 5 * 60 * 1000

/**
 * Render free засыпает после 15 мин без входящих запросов. Запрос на свой публичный URL идёт через прокси Render
 * и считается входящим, а /api/health заодно делает SELECT — Supabase тоже не уснёт.
 * RENDER_EXTERNAL_URL Render задаёт сам; локально переменной нет — плагин ничего не делает.
 */
export default defineNitroPlugin(() => {
  const base = process.env.RENDER_EXTERNAL_URL
  if (!base) return
  const url = `${base.replace(/\/$/, '')}/api/health`
  setInterval(() => {
    fetch(url).catch((e) => console.warn('[keep-alive] ping failed', e))
  }, INTERVAL_MS)
})
