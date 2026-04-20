export default defineNuxtRouteMiddleware(async (to) => {
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  let me: { authed: boolean; authDisabled?: boolean }
  try {
    me = await $fetch('/api/auth/me', { headers })
  } catch {
    me = { authed: false }
  }

  if (me.authDisabled) {
    if (to.path === '/login') return navigateTo('/trades')
    return
  }

  if (to.path === '/login') {
    if (me.authed) return navigateTo('/trades')
    return
  }

  if (!me.authed) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
