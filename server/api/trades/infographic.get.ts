import { eq, inArray } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { labelDefs, tradeLabelLinks } from '../../database/schema'
import { serializeTrade } from '../../utils/serialize'
import { queryTradesForList } from '../../utils/queryTradesForList'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const q = getQuery(event)
  const rows = await queryTradesForList(db, q)
  const serialized = rows.map(serializeTrade)
  const ids = rows.map((r) => r.id)
  if (!ids.length) return { trades: [] }

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
  return { trades }
})
