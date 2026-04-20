import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { strategyDoc } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { markdown?: string }
  const db = useDb()
  const now = new Date()
  await db
    .update(strategyDoc)
    .set({ markdown: body.markdown ?? '', updatedAt: now })
    .where(eq(strategyDoc.id, 1))
  const [row] = await db.select().from(strategyDoc).where(eq(strategyDoc.id, 1))
  return row
})
