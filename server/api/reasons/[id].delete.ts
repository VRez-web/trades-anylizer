import { or, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, reasons } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const db = useDb()
  const used = await db
    .select({ id: trades.id })
    .from(trades)
    .where(or(eq(trades.entryReasonId, id), eq(trades.exitReasonId, id)))
    .limit(1)
  if (used.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Reason is used by trades' })
  }
  await db.delete(reasons).where(eq(reasons.id, id))
  return { ok: true }
})
