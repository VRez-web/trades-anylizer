import { and, asc, desc, eq, gte, inArray, lte, not, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { trades, tradeLabelLinks } from '../database/schema'
import type { AppDatabase } from '../types/app-database'
import { localDayBounds } from './stats'
import type { TradeRow } from './tradeMath'

type Db = AppDatabase

/** Соответствует `isAnalysisComplete` / `isGeneralAnalysisComplete` + `isTsAnalysisComplete` в tradeMath. */
function sqlHasAnyAnalysis(): SQL {
  const general = or(
    sql`length(trim(coalesce(${trades.noteSystem}, ''))) > 0`,
    sql`length(trim(coalesce(${trades.noteTechnique}, ''))) > 0`,
    sql`length(trim(coalesce(${trades.noteAnalysis}, ''))) > 0`,
  )!
  const tsTriplet = and(
    sql`length(trim(coalesce(${trades.noteSystemTs}, ''))) > 0`,
    sql`length(trim(coalesce(${trades.noteTechniqueTs}, ''))) > 0`,
    sql`length(trim(coalesce(${trades.noteAnalysisTs}, ''))) > 0`,
  )!
  const tsOnly = and(
    sql`length(trim(coalesce(${trades.noteSystemTs}, ''))) = 0`,
    sql`length(trim(coalesce(${trades.noteTechniqueTs}, ''))) = 0`,
    sql`length(trim(coalesce(${trades.noteAnalysisTs}, ''))) > 0`,
  )!
  const tsBlock = or(tsTriplet, tsOnly)!
  return or(general, tsBlock)!
}

function appendAnalysisFilter(conditions: SQL[], q: Record<string, unknown>) {
  const af = q.analysis
  if (af !== 'with' && af !== 'without') return
  const expr = sqlHasAnyAnalysis()
  if (af === 'with') {
    conditions.push(expr)
  } else {
    conditions.push(not(expr))
  }
}

function appendRrFilter(conditions: SQL[], q: Record<string, unknown>) {
  const rrMin = Number(q.rrMin)
  const rrMax = Number(q.rrMax)
  if (Number.isFinite(rrMin)) conditions.push(gte(trades.rr, rrMin))
  if (Number.isFinite(rrMax)) conditions.push(lte(trades.rr, rrMax))
}

/** Общая выборка для `/api/trades` и `/api/trades/infographic` (без `day` — только список с фильтрами). */
export async function queryTradesForList(db: Db, q: Record<string, unknown>): Promise<TradeRow[]> {
  if (q.day && typeof q.day === 'string') {
    const { from, to } = localDayBounds(q.day)
    const dayCond: SQL[] = [gte(trades.exitAt, from), lte(trades.exitAt, to)]
    appendAnalysisFilter(dayCond, q)
    appendRrFilter(dayCond, q)
    return db
      .select()
      .from(trades)
      .where(and(...dayCond))
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

  appendAnalysisFilter(conditions, q)
  appendRrFilter(conditions, q)

  const sortDesc = q.sort === 'exit_desc'
  const order = sortDesc ? desc(trades.exitAt) : asc(trades.exitAt)

  const whereExpr = conditions.length ? and(...conditions) : undefined
  if (whereExpr) {
    return db.select().from(trades).where(whereExpr).orderBy(order)
  }
  return db.select().from(trades).orderBy(order)
}
