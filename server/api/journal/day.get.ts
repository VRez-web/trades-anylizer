import { and, gte, lte, asc, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, periodNotes } from '../../database/schema'
import { serializeTrade } from '../../utils/serialize'
import { aggregateTrades, localDayBounds } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const dateStr = String(q.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw createError({ statusCode: 400, statusMessage: 'date=YYYY-MM-DD' })
  }
  let from: Date
  let to: Date
  try {
    ;({ from, to } = localDayBounds(dateStr))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid date' })
  }
  const db = useDb()
  const list = await db
    .select()
    .from(trades)
    .where(and(gte(trades.exitAt, from), lte(trades.exitAt, to)))
    .orderBy(asc(trades.exitAt))
  const stats = aggregateTrades(list)
  const [note] = await db
    .select()
    .from(periodNotes)
    .where(and(eq(periodNotes.scope, 'day'), eq(periodNotes.periodKey, dateStr)))
  return {
    date: dateStr,
    stats,
    trades: list.map(serializeTrade),
    note: note?.content ?? '',
    tradePlan: note?.tradePlan ?? '',
    noteUpdatedAt: note?.updatedAt?.toISOString() ?? null,
  }
})
