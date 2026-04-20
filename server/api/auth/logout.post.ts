import { clearSessionCookie } from '../../utils/authCookie'

export default defineEventHandler((event) => {
  clearSessionCookie(event)
  return { ok: true }
})
