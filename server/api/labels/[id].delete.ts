import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { labelDefs } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const db = useDb()
  const [existing] = await db.select({ id: labelDefs.id }).from(labelDefs).where(eq(labelDefs.id, id))
  if (!existing) throw createError({ statusCode: 404 })
  await db.delete(labelDefs).where(eq(labelDefs.id, id))
  return { ok: true }
})
