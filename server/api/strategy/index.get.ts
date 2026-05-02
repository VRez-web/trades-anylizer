import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { strategyDoc } from '../../database/schema'
import { decodeStrategyDoc } from '../../utils/strategyDoc'

export default defineEventHandler(async () => {
  const db = useDb()
  const [row] = await db.select().from(strategyDoc).where(eq(strategyDoc.id, 1))
  const base = row != null ? row : { id: 1, markdown: '', updatedAt: new Date() }
  const decoded = decodeStrategyDoc(base.markdown)
  return {
    ...base,
    markdown: decoded.systems.find((x) => x.asset === decoded.activeAsset)?.markdown ?? '',
    systems: decoded.systems,
    activeAsset: decoded.activeAsset,
  }
})
