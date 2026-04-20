import { getAuthRuntime, isAuthEnabled } from '../../utils/authConfig'
import { hasValidSession } from '../../utils/authCookie'

export default defineEventHandler((event) => {
  const config = getAuthRuntime(event)
  if (!isAuthEnabled(config)) {
    return { authed: true, authDisabled: true as const }
  }
  return { authed: hasValidSession(event, config), authDisabled: false as const }
})
