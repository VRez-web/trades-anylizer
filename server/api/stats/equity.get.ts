import { useDb } from '../../utils/db'
import { equitySeries } from '../../utils/stats'

export default defineEventHandler(async () => {
  const db = useDb()
  return equitySeries(db)
})
