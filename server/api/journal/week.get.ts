import { addWeeks, startOfISOWeek, endOfISOWeek, eachDayOfInterval, format } from 'date-fns'
import { and, gte, lte, asc, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, periodNotes } from '../../database/schema'
import { aggregateTrades, periodKeyWeek, exitDateKeyLocal } from '../../utils/stats'
import { netProfit } from '../../utils/tradeMath'

export default defineEventHandler(async (event) => {
  const offset = Number(getQuery(event).offset ?? 0)
  if (!Number.isFinite(offset)) throw createError({ statusCode: 400 })
  const base = addWeeks(new Date(), offset)
  const start = startOfISOWeek(base, { weekStartsOn: 1 })
  const end = endOfISOWeek(base, { weekStartsOn: 1 })
  const weekKey = periodKeyWeek(base)
  const db = useDb()
  const list = await db
    .select()
    .from(trades)
    .where(and(gte(trades.exitAt, start), lte(trades.exitAt, end)))
    .orderBy(asc(trades.exitAt))
  const stats = aggregateTrades(list)
  const days = eachDayOfInterval({ start, end })
  const dayBlocks = days.map((d) => {
    const key = exitDateKeyLocal(d)
    const dayTrades = list.filter((t) => exitDateKeyLocal(t.exitAt) === key)
    return {
      date: key,
      label: format(d, 'EEE d MMM', { locale: undefined }),
      stats: aggregateTrades(dayTrades),
      trades: dayTrades.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        net: netProfit(t),
      })),
    }
  })
  const [note] = await db
    .select()
    .from(periodNotes)
    .where(and(eq(periodNotes.scope, 'week'), eq(periodNotes.periodKey, weekKey)))
  return {
    offset,
    weekKey,
    range: { start: start.toISOString(), end: end.toISOString() },
    stats,
    dayBlocks,
    note: note?.content ?? '',
    noteUpdatedAt: note?.updatedAt?.toISOString() ?? null,
  }
})
