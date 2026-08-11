import { useDb } from '../../utils/db'
import { propSummary } from '../../utils/propCashflow'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const accountName = typeof q.accountName === 'string' && q.accountName.trim() ? q.accountName.trim() : undefined
  const db = useDb()
  const summary = await propSummary(db, accountName)
  return { summary }
})
