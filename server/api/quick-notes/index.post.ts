import { useDb } from '../../utils/db'
import { quickNotes } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { title?: string; body?: string } | null
  const db = useDb()
  const [row] = await db
    .insert(quickNotes)
    .values({ title: String(body?.title ?? ''), body: String(body?.body ?? ''), updatedAt: new Date() })
    .returning()
  return row
})
