import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { strategyDoc } from '../../database/schema'
import { decodeStrategyDoc, encodeStrategyDoc, type StrategySystemItem } from '../../utils/strategyDoc'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as {
    markdown?: string
    systems?: StrategySystemItem[]
    activeAsset?: string
  }
  const db = useDb()
  const now = new Date()
  const [existing] = await db.select().from(strategyDoc).where(eq(strategyDoc.id, 1))
  const existingDecoded = decodeStrategyDoc(existing?.markdown ?? '')

  const encoded = encodeStrategyDoc(
    body.systems ?? existingDecoded.systems.map((x) => ({ ...x, markdown: body.markdown ?? x.markdown })),
    body.activeAsset ?? existingDecoded.activeAsset,
  )
  await db
    .update(strategyDoc)
    .set({ markdown: encoded, updatedAt: now })
    .where(eq(strategyDoc.id, 1))
  const [row] = await db.select().from(strategyDoc).where(eq(strategyDoc.id, 1))
  const base = row ?? { id: 1, markdown: encoded, updatedAt: now }
  const decoded = decodeStrategyDoc(base.markdown)
  return {
    ...base,
    markdown: decoded.systems.find((x) => x.asset === decoded.activeAsset)?.markdown ?? '',
    systems: decoded.systems,
    activeAsset: decoded.activeAsset,
  }
})
