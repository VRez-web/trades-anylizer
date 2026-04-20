import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { strategyDoc } from '../../database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  const [row] = await db.select().from(strategyDoc).where(eq(strategyDoc.id, 1))
  return row != null ? row : { id: 1, markdown: '', updatedAt: new Date() }
})
