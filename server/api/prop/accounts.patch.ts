import { useDb } from '../../utils/db'
import { parsePropAccountStatus, updatePropAccountStatus } from '../../utils/propAccounts'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const name = String(body.name ?? '').trim()
  const status = parsePropAccountStatus(body.status)
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name required' })
  }
  const db = useDb()
  const row = await updatePropAccountStatus(db, name, status)
  return { name: row.name, status: row.status }
})
