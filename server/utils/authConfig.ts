import type { H3Event } from 'h3'

export type AuthRuntime = {
  adminUser?: string
  adminPassword?: string
  authSecret?: string
}

/** Авторизация включена, если в env заданы и логин, и пароль. */
export function isAuthEnabled(config: AuthRuntime): boolean {
  const u = config.adminUser != null ? String(config.adminUser).trim() : ''
  const p = config.adminPassword != null ? String(config.adminPassword).trim() : ''
  return Boolean(u && p)
}

export function resolveAuthSecret(config: AuthRuntime): string {
  const s = config.authSecret != null ? String(config.authSecret).trim() : ''
  return s || 'nuxt-auth-dev-only-set-NUXT_AUTH_SECRET'
}

export function getAuthRuntime(event: H3Event): AuthRuntime {
  return useRuntimeConfig(event) as AuthRuntime
}
