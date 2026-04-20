import { and, gte, lte, asc, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, periodNotes } from '../../database/schema'
import { serializeTrade } from '../../utils/serialize'
import { aggregateTrades, periodKeyMonth, localMonthBounds } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const y = Number(q.year)
  const m = Number(q.month)
  if (!Number.isFinite(y) || m < 1 || m > 12) {
    throw createError({ statusCode: 400, statusMessage: 'year and month (1-12) required' })
  }
  const monthKey = `${y}-${String(m).padStart(2, '0')}`
  const { from, to } = localMonthBounds(y, m - 1)
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
    .where(and(eq(periodNotes.scope, 'month'), eq(periodNotes.periodKey, monthKey)))
  const anchor = new Date(y, m - 1, 15)
  return {
    year: y,
    month: m,
    monthKey,
    periodKey: periodKeyMonth(anchor),
    stats,
    trades: list.map(serializeTrade),
    note: note?.content ?? '',
    noteUpdatedAt: note?.updatedAt?.toISOString() ?? null,
  }
})
