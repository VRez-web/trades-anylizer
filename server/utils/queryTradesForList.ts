import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { trades, tradeLabelLinks } from '../database/schema'
import type * as schema from '../database/schema'
import { localDayBounds } from './stats'
import type { TradeRow } from './tradeMath'

type Db = BetterSQLite3Database<typeof schema>

/** Общая выборка для `/api/trades` и `/api/trades/infographic` (без `day` — только список с фильтрами). */
export async function queryTradesForList(db: Db, q: Record<string, unknown>): Promise<TradeRow[]> {
  if (q.day && typeof q.day === 'string') {
    const { from, to } = localDayBounds(q.day)
    return db
      .select()
      .from(trades)
      .where(and(gte(trades.exitAt, from), lte(trades.exitAt, to)))
      .orderBy(asc(trades.entryAt), asc(trades.id))
  }

  const conditions: SQL[] = []

  if (q.side === 'long' || q.side === 'short') {
    conditions.push(eq(trades.side, q.side))
  }
  if (q.result === 'win') {
    conditions.push(sql`${trades.income} - ${trades.commission} + ${trades.funding} > 0`)
  } else if (q.result === 'loss') {
    conditions.push(sql`${trades.income} - ${trades.commission} + ${trades.funding} < 0`)
  }
  if (q.from && typeof q.from === 'string') {
    const from = new Date(q.from)
    if (!Number.isNaN(+from)) conditions.push(gte(trades.exitAt, from))
  }
  if (q.to && typeof q.to === 'string') {
    const to = new Date(q.to)
    if (!Number.isNaN(+to)) conditions.push(lte(trades.exitAt, to))
  }

  const labelId = Number(q.labelId)
  if (Number.isFinite(labelId) && labelId > 0) {
    const linked = await db
      .select({ tid: tradeLabelLinks.tradeId })
      .from(tradeLabelLinks)
      .where(eq(tradeLabelLinks.labelId, labelId))
    const tids = linked.map((x) => x.tid)
    if (tids.length === 0) return []
    conditions.push(inArray(trades.id, tids))
  }

  const sortDesc = q.sort === 'exit_desc'
  const order = sortDesc ? desc(trades.exitAt) : asc(trades.exitAt)

  const whereExpr = conditions.length ? and(...conditions) : undefined
  if (whereExpr) {
    return db.select().from(trades).where(whereExpr).orderBy(order)
  }
  return db.select().from(trades).orderBy(order)
}
