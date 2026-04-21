import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, labelDefs, tradeLabelLinks } from '../../database/schema'
import { serializeTrade } from '../../utils/serialize'
import type { LabelKind } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const db = useDb()
  const [t] = await db.select().from(trades).where(eq(trades.id, id))
  if (!t) throw createError({ statusCode: 404 })
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
  return { trade: serializeTrade(t), labels }
})
