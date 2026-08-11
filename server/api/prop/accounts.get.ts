import { useDb } from '../../utils/db'
import { propAccountNames } from '../../utils/propCashflow'

export default defineEventHandler(async () => {
  const db = useDb()
  const names = await propAccountNames(db)
  return { names }
})
