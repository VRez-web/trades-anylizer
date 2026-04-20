import { useDb } from '../../utils/db'
import { calendarMonth, calendarMonthJournalFlags } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const y = Number(q.year ?? new Date().getUTCFullYear())
  const m = Number(q.month ?? new Date().getUTCMonth() + 1)
  if (!Number.isFinite(y) || m < 1 || m > 12) {
    throw createError({ statusCode: 400, statusMessage: 'year, month (1-12) required' })
  }
  const db = useDb()
  const [{ byDay }, journalByDay] = await Promise.all([
    calendarMonth(db, y, m - 1),
    calendarMonthJournalFlags(db, y, m),
  ])
  return {
    year: y,
    month: m,
    days: Object.fromEntries(byDay.entries()),
    journalByDay,
  }
})
