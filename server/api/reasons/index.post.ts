import { useDb } from '../../utils/db'
import { reasons } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { kind?: string; label?: string }
  if (!body?.kind || !body?.label?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'kind and label required' })
  }
  const db = useDb()
  const now = new Date()
  const [row] = await db
    .insert(reasons)
    .values({ kind: body.kind as 'entry' | 'exit', label: body.label.trim(), createdAt: now })
    .returning()
  return row
})
