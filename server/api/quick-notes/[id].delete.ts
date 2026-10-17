import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { quickNotes } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const db = useDb()
  const [row] = await db.delete(quickNotes).where(eq(quickNotes.id, id)).returning({ id: quickNotes.id })
  if (!row) throw createError({ statusCode: 404 })
  return { ok: true }
})
