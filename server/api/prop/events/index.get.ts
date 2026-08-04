import { asc } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { propEvents } from '../../../database/schema'
import { serializePropEvent } from '../../../utils/propCashflow'

export default defineEventHandler(async () => {
  const db = useDb()
  const rows = await db.select().from(propEvents).orderBy(asc(propEvents.eventAt), asc(propEvents.id))
  return rows.map(serializePropEvent)
})
