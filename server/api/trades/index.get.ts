import { useDb } from '../../utils/db'
import { serializeTrade } from '../../utils/serialize'
import { queryTradesForList } from '../../utils/queryTradesForList'
import { labelDefs, tradeLabelLinks } from '../../database/schema'
import { inArray, eq } from 'drizzle-orm'
import { emptyLabelPack, type LabelKind } from '#shared/labelKind'

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

  const byTradeId = new Map<number, Record<LabelKind, string[]>>()
  for (const id of ids) byTradeId.set(id, emptyLabelPack<string>())
  for (const row of links) {
    byTradeId.get(row.tradeId)?.[row.kind].push(row.label)
  }

  return serialized.map((t) => ({
    ...t,
    labels: byTradeId.get(t.id) ?? emptyLabelPack<string>(),
  }))
})
