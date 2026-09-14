import { useDb } from '../../utils/db'
import { propAccountsPayload } from '../../utils/propAccounts'

export default defineEventHandler(async () => {
  const db = useDb()
  return propAccountsPayload(db)
})
