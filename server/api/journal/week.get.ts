import { addWeeks, startOfISOWeek, endOfISOWeek, eachDayOfInterval, format } from 'date-fns'
import { and, gte, lte, asc, eq, inArray } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, periodNotes, labelDefs, tradeLabelLinks } from '../../database/schema'
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
  const tradeIds = list.map((t) => t.id)
  let labelSummary: { key: string; count: number; sum: number }[] = []
  if (tradeIds.length) {
    const rows = await db
      .select({
        tradeId: tradeLabelLinks.tradeId,
        kind: labelDefs.kind,
        label: labelDefs.label,
      })
      .from(trades)
      .innerJoin(tradeLabelLinks, eq(trades.id, tradeLabelLinks.tradeId))
      .innerJoin(labelDefs, eq(tradeLabelLinks.labelId, labelDefs.id))
      .where(inArray(trades.id, tradeIds))

    const linksByTrade = new Map<number, { kind: string; label: string }[]>()
    for (const row of rows) {
      const cur = linksByTrade.get(row.tradeId) ?? []
      cur.push({ kind: row.kind, label: row.label })
      linksByTrade.set(row.tradeId, cur)
    }

    const agg = new Map<string, { count: number; sum: number }>()
    for (const t of list) {
      const net = netProfit(t)
      const labels = linksByTrade.get(t.id) ?? []
      if (!labels.length) {
        const k = '— без лейблов'
        const cur = agg.get(k) ?? { count: 0, sum: 0 }
        cur.count += 1
        cur.sum += net
        agg.set(k, cur)
        continue
      }
      for (const lb of labels) {
        const k = `[${lb.kind}] ${lb.label}`
        const cur = agg.get(k) ?? { count: 0, sum: 0 }
        cur.count += 1
        cur.sum += net
        agg.set(k, cur)
      }
    }
    labelSummary = [...agg.entries()]
      .map(([key, v]) => ({ key, count: v.count, sum: v.sum }))
      .sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum))
  }
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
    labelSummary,
    dayBlocks,
    note: note?.content ?? '',
    noteUpdatedAt: note?.updatedAt?.toISOString() ?? null,
  }
})
