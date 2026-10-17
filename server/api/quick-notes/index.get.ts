import { desc } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { quickNotes } from '../../database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  return db.select().from(quickNotes).orderBy(desc(quickNotes.updatedAt))
})
