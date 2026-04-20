import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, reasons } from '../../database/schema'
import { serializeTrade } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const db = useDb()
  const [t] = await db.select().from(trades).where(eq(trades.id, id))
  if (!t) throw createError({ statusCode: 404 })
  let entryReason: { id: number; label: string } | null = null
  let exitReason: { id: number; label: string } | null = null
  if (t.entryReasonId != null) {
    const [r] = await db.select().from(reasons).where(eq(reasons.id, t.entryReasonId))
    if (r) entryReason = { id: r.id, label: r.label }
  }
  if (t.exitReasonId != null) {
    const [r] = await db.select().from(reasons).where(eq(reasons.id, t.exitReasonId))
    if (r) exitReason = { id: r.id, label: r.label }
  }
  return { trade: serializeTrade(t), entryReason, exitReason }
})
