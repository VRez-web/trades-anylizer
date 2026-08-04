import { useDb } from '../../utils/db'
import { propCashflowSeries, propSummary } from '../../utils/propCashflow'

export default defineEventHandler(async () => {
  const db = useDb()
  const [summary, series] = await Promise.all([propSummary(db), propCashflowSeries(db)])
  return { summary, series }
})
