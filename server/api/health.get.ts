import { useDb } from '../utils/db'
import { strategyDoc } from '../database/schema'

/** Проверка БД без тела ошибки в ответе (детали — в логах Render). */
export default defineEventHandler(async () => {
  try {
    const db = useDb()
    await db.select().from(strategyDoc).limit(1)
    return { ok: true, database: 'up' as const }
  } catch (e) {
    console.error('[health] database check failed', e)
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
})
