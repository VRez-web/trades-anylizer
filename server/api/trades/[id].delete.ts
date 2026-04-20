import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const db = useDb()
  const [existing] = await db.select().from(trades).where(eq(trades.id, id))
  if (!existing) throw createError({ statusCode: 404 })
  await db.delete(trades).where(eq(trades.id, id))
  return { ok: true }
})
