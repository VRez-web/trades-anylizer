import { timingSafeEqual } from 'node:crypto'
import { getAuthRuntime, isAuthEnabled } from '../../utils/authConfig'
import { setSessionCookie } from '../../utils/authCookie'

function eq(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export default defineEventHandler(async (event) => {
  const config = getAuthRuntime(event)
  if (!isAuthEnabled(config)) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Авторизация не настроена: задайте NUXT_ADMIN_USER и NUXT_ADMIN_PASSWORD',
    })
  }
  const body = (await readBody(event).catch(() => ({}))) as { login?: string; password?: string }
  const login = String(body.login ?? '')
  const password = String(body.password ?? '')
  const okUser = eq(login.trim(), String(config.adminUser ?? '').trim())
  const okPass = eq(password, String(config.adminPassword ?? ''))
  if (!okUser || !okPass) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный логин или пароль' })
  }
  setSessionCookie(event, config)
  return { ok: true }
})
