import { eq, asc } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { reasons } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const q = getQuery(event)
  const kind = q.kind
  if (kind === 'entry' || kind === 'exit') {
    return db.select().from(reasons).where(eq(reasons.kind, kind)).orderBy(asc(reasons.id))
  }
  return db.select().from(reasons).orderBy(asc(reasons.kind), asc(reasons.id))
})
