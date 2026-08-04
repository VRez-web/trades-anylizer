import { eq } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { propEvents } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const db = useDb()
  const [existing] = await db.select({ id: propEvents.id }).from(propEvents).where(eq(propEvents.id, id))
  if (!existing) throw createError({ statusCode: 404 })
  await db.delete(propEvents).where(eq(propEvents.id, id))
  return { ok: true }
})
