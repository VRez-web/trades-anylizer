import { useDb } from '../../utils/db'
import { combinedEquitySeries } from '../../utils/stats'

export default defineEventHandler(async () => {
  const db = useDb()
  return combinedEquitySeries(db)
})
