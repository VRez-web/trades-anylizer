import { ensureDbSeeded } from '../utils/db'

/** Перед API: строка strategy_doc (id=1) при пустой БД. */
export default defineNitroPlugin(async () => {
  await ensureDbSeeded()
})
