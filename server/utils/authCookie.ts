import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie } from 'h3'
import { resolveAuthSecret, type AuthRuntime } from './authConfig'

export const AUTH_COOKIE = 'ta_auth'
const MAX_AGE_SEC = 60 * 60 * 24 * 7

function signPayload(exp: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifyToken(token: string, secret: string): boolean {
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payloadB64 = token.slice(0, dot)
  const sigB64 = token.slice(dot + 1)
  const expected = createHmac('sha256', secret).update(payloadB64).digest('base64url')
  let a: Buffer
  let b: Buffer
  try {
    a = Buffer.from(sigB64, 'base64url')
    b = Buffer.from(expected, 'base64url')
  } catch {
    return false
  }
  if (a.length !== b.length) return false
  if (!timingSafeEqual(a, b)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { exp: number }
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

export function hasValidSession(event: H3Event, config: AuthRuntime): boolean {
  const token = getCookie(event, AUTH_COOKIE)
  if (!token) return false
  return verifyToken(token, resolveAuthSecret(config))
}

export function setSessionCookie(event: H3Event, config: AuthRuntime): void {
  const secret = resolveAuthSecret(config)
  const exp = Date.now() + MAX_AGE_SEC * 1000
  const value = signPayload(exp, secret)
  setCookie(event, AUTH_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEC,
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, AUTH_COOKIE, { path: '/' })
}
