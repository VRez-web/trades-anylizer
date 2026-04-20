import { and, gte, lte, asc } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades } from '../../database/schema'
import { serializeTrade } from '../../utils/serialize'
import { localDayBounds } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const q = getQuery(event)
  if (q.day && typeof q.day === 'string') {
    const { from, to } = localDayBounds(q.day)
    const rows = await db
      .select()
      .from(trades)
      .where(and(gte(trades.exitAt, from), lte(trades.exitAt, to)))
      .orderBy(asc(trades.exitAt))
    return rows.map(serializeTrade)
  }
  if (q.from && q.to) {
    const from = new Date(String(q.from))
    const to = new Date(String(q.to))
    if (Number.isNaN(+from) || Number.isNaN(+to)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid from/to' })
    }
    const rows = await db
      .select()
      .from(trades)
      .where(and(gte(trades.exitAt, from), lte(trades.exitAt, to)))
      .orderBy(asc(trades.exitAt))
    return rows.map(serializeTrade)
  }
  const rows = await db.select().from(trades).orderBy(asc(trades.exitAt))
  return rows.map(serializeTrade)
})
