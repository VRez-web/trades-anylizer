import { useDb } from '../../utils/db'
import { pnlByLabelInMonth } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const year = Math.floor(Number(q.year))
  const month = Math.floor(Number(q.month))
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw createError({ statusCode: 400, statusMessage: 'year и month (1–12) обязательны' })
  }
  const db = useDb()
  const [system, technique, psychology] = await Promise.all([
    pnlByLabelInMonth(db, 'system', year, month),
    pnlByLabelInMonth(db, 'technique', year, month),
    pnlByLabelInMonth(db, 'psychology', year, month),
  ])
  return { year, month, system, technique, psychology }
})
