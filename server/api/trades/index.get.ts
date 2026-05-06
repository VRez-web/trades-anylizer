import { useDb } from '../../utils/db'
import { serializeTrade } from '../../utils/serialize'
import { queryTradesForList } from '../../utils/queryTradesForList'
import { labelDefs, tradeLabelLinks } from '../../database/schema'
import { inArray, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const q = getQuery(event)
  const rows = await queryTradesForList(db, q)
  const serialized = rows.map(serializeTrade)
  if (!(q.day && typeof q.day === 'string') || !serialized.length) return serialized

  const ids = serialized.map((x) => x.id)
  const links = await db
    .select({
      tradeId: tradeLabelLinks.tradeId,
      kind: labelDefs.kind,
      label: labelDefs.label,
    })
    .from(tradeLabelLinks)
    .innerJoin(labelDefs, eq(tradeLabelLinks.labelId, labelDefs.id))
    .where(inArray(tradeLabelLinks.tradeId, ids))

  const byTradeId = new Map<number, { system: string[]; technique: string[]; psychology: string[] }>()
  for (const id of ids) byTradeId.set(id, { system: [], technique: [], psychology: [] })
  for (const row of links) {
    const target = byTradeId.get(row.tradeId)
    if (!target) continue
    if (row.kind === 'system') target.system.push(row.label)
    else if (row.kind === 'technique') target.technique.push(row.label)
    else if (row.kind === 'psychology') target.psychology.push(row.label)
  }

  return serialized.map((t) => ({
    ...t,
    labels: byTradeId.get(t.id) ?? { system: [], technique: [], psychology: [] },
  }))
})
