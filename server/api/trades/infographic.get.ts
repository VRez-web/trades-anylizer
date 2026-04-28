import { and, eq, inArray } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { labelDefs, periodNotes, tradeLabelLinks } from '../../database/schema'
import { serializeTrade } from '../../utils/serialize'
import { queryTradesForList } from '../../utils/queryTradesForList'
import { exitDateKeyLocal } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const q = getQuery(event)
  const rows = await queryTradesForList(db, q)
  const serialized = rows.map(serializeTrade)
  const ids = rows.map((r) => r.id)
  if (!ids.length) {
    return {
      trades: [],
      dayJournal: {
        totalDays: 0,
        daysWithAnalysis: 0,
        daysWithTradePlan: 0,
        daysWithBoth: 0,
        daysWithoutAny: 0,
      },
    }
  }

  const linkRows = await db
    .select({
      tradeId: tradeLabelLinks.tradeId,
      kind: labelDefs.kind,
      label: labelDefs.label,
    })
    .from(tradeLabelLinks)
    .innerJoin(labelDefs, eq(tradeLabelLinks.labelId, labelDefs.id))
    .where(inArray(tradeLabelLinks.tradeId, ids))

  const byTrade = new Map<number, { kind: string; label: string }[]>()
  for (const r of linkRows) {
    const list = byTrade.get(r.tradeId) ?? []
    list.push({ kind: r.kind, label: r.label })
    byTrade.set(r.tradeId, list)
  }

  const trades = serialized.map((t) => ({
    ...t,
    labels: byTrade.get(t.id) ?? [],
  }))

  const dayKeys = Array.from(new Set(rows.map((r) => exitDateKeyLocal(r.exitAt))))
  const dayNotes =
    dayKeys.length === 0
      ? []
      : await db
          .select({
            periodKey: periodNotes.periodKey,
            content: periodNotes.content,
            tradePlan: periodNotes.tradePlan,
          })
          .from(periodNotes)
          .where(and(eq(periodNotes.scope, 'day'), inArray(periodNotes.periodKey, dayKeys)))
  const notesByDay = new Map(dayNotes.map((x) => [x.periodKey, x]))
  let daysWithAnalysis = 0
  let daysWithTradePlan = 0
  let daysWithBoth = 0
  for (const dayKey of dayKeys) {
    const note = notesByDay.get(dayKey)
    const hasAnalysis = Boolean(note?.content?.trim().length)
    const hasTradePlan = Boolean(note?.tradePlan?.trim().length)
    if (hasAnalysis) daysWithAnalysis++
    if (hasTradePlan) daysWithTradePlan++
    if (hasAnalysis && hasTradePlan) daysWithBoth++
  }
  const totalDays = dayKeys.length
  return {
    trades,
    dayJournal: {
      totalDays,
      daysWithAnalysis,
      daysWithTradePlan,
      daysWithBoth,
      daysWithoutAny: totalDays - (daysWithAnalysis + daysWithTradePlan - daysWithBoth),
    },
  }
})
