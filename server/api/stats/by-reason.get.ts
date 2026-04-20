import { useDb } from '../../utils/db'
import { pnlByReason } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const kind = q.kind === 'exit' ? ('exit' as const) : ('entry' as const)
  const db = useDb()
  return pnlByReason(db, kind)
})
