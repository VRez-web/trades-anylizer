import { and, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { periodNotes } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const scope = q.scope
  const periodKey = q.key
  if (scope !== 'day' && scope !== 'week' && scope !== 'month') {
    throw createError({ statusCode: 400, statusMessage: 'scope=day|week|month' })
  }
  if (!periodKey) throw createError({ statusCode: 400, statusMessage: 'key required' })
  const db = useDb()
  const [row] = await db
    .select()
    .from(periodNotes)
    .where(and(eq(periodNotes.scope, scope), eq(periodNotes.periodKey, String(periodKey))))
  return row != null
    ? row
    : { scope, periodKey, content: '', tradePlan: '', updatedAt: null }
})
