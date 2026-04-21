import { useDb } from '../../utils/db'
import { serializeTrade } from '../../utils/serialize'
import { queryTradesForList } from '../../utils/queryTradesForList'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const q = getQuery(event)
  const rows = await queryTradesForList(db, q)
  return rows.map(serializeTrade)
})
