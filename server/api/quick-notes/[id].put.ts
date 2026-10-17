import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { quickNotes } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const body = (await readBody(event)) as { title?: string; body?: string } | null
  const patch: { title?: string; body?: string; updatedAt: Date } = { updatedAt: new Date() }
  if (body?.title !== undefined) patch.title = String(body.title)
  if (body?.body !== undefined) patch.body = String(body.body)
  const db = useDb()
  const [row] = await db.update(quickNotes).set(patch).where(eq(quickNotes.id, id)).returning()
  if (!row) throw createError({ statusCode: 404 })
  return row
})
