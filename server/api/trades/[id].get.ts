import { eq, and, ne } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, labelDefs, tradeLabelLinks } from '../../database/schema'
import { serializeTrade } from '../../utils/serialize'
import { netProfit } from '../../utils/tradeMath'
import { repairMergedLegsIfNeeded } from '../../utils/repairMergedLegsFromBybit'
import type { LabelKind } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const db = useDb()
  let [t] = await db.select().from(trades).where(eq(trades.id, id))
  if (!t) throw createError({ statusCode: 404 })
  const repaired = await repairMergedLegsIfNeeded(event, db, t)
  if (repaired) t = repaired
  let mergeGroupTrades: { id: number; net: number }[] = []
  if (t.mergeGroupId != null) {
    const sibs = await db
      .select()
      .from(trades)
      .where(and(eq(trades.mergeGroupId, t.mergeGroupId), ne(trades.id, id)))
    mergeGroupTrades = sibs.map((r) => ({ id: r.id, net: netProfit(r) }))
  }
  const links = await db
    .select({ kind: labelDefs.kind, id: labelDefs.id, label: labelDefs.label })
    .from(tradeLabelLinks)
    .innerJoin(labelDefs, eq(tradeLabelLinks.labelId, labelDefs.id))
    .where(eq(tradeLabelLinks.tradeId, id))
  const labels: Record<LabelKind, { id: number; label: string }[]> = {
    system: [],
    technique: [],
    psychology: [],
  }
  for (const r of links) {
    labels[r.kind].push({ id: r.id, label: r.label })
  }
  return { trade: serializeTrade(t), labels, mergeGroupTrades }
})
