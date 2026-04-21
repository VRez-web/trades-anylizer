import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, mergeGroups } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { mergeGroupId?: unknown }
  const gid = Number(body.mergeGroupId)
  if (!Number.isFinite(gid) || gid <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'mergeGroupId обязателен' })
  }
  const db = useDb()
  const [g] = await db.select({ id: mergeGroups.id }).from(mergeGroups).where(eq(mergeGroups.id, gid))
  if (!g) throw createError({ statusCode: 404 })
  const now = new Date()
  await db.update(trades).set({ mergeGroupId: null, updatedAt: now }).where(eq(trades.mergeGroupId, gid))
  await db.delete(mergeGroups).where(eq(mergeGroups.id, gid))
  return { ok: true }
})
