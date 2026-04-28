import { getAuthRuntime, isAuthEnabled } from '../utils/authConfig'
import { hasValidSession } from '../utils/authCookie'

export default defineEventHandler((event) => {
  const config = getAuthRuntime(event)
  if (!isAuthEnabled(config)) return

  const path = getRequestURL(event).pathname
  const method = getMethod(event)

  if (path === '/api/auth/login' && method === 'POST') return
  if (path === '/api/auth/me' && method === 'GET') return
  if (path === '/api/auth/logout' && method === 'POST') return
  if (path === '/api/health' && method === 'GET') return

  if (!path.startsWith('/api/')) return

  if (!hasValidSession(event, config)) {
    throw createError({ statusCode: 401, statusMessage: 'Требуется вход' })
  }
})
