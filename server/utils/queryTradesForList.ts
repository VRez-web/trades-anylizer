import { and, asc, desc, eq, gte, inArray, lte, not, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { trades, tradeLabelLinks } from '../database/schema'
import type { AppDatabase } from '../types/app-database'
import { dayBoundsAtOffset, localDayBounds } from './stats'
import type { TradeRow } from './tradeMath'
import { selectTradesExcludingMergedOrphans } from './mergedTradeSync'

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

/** 0=вс … 6=сб (как Date#getDay) в часовом поясе пользователя (tzOffset = getTimezoneOffset). */
function parseWeekdays(q: Record<string, unknown>): number[] {
  const raw = q.weekdays ?? q.weekday
  const out: number[] = []
  const add = (v: unknown) => {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0 && n <= 6 && !out.includes(n)) out.push(n)
  }
  if (typeof raw === 'string' && raw.trim()) {
    for (const part of raw.split(',')) add(part.trim())
  } else if (Array.isArray(raw)) {
    for (const v of raw) add(v)
  } else if (raw != null && raw !== '') add(raw)
  return out
}

function appendWeekdayFilter(conditions: SQL[], q: Record<string, unknown>) {
  const days = parseWeekdays(q)
  if (!days.length) return
  const tzOffset = Number(q.tzOffset)
  if (!Number.isFinite(tzOffset)) return
  const dow = sql`EXTRACT(DOW FROM (${trades.exitAt} - (${tzOffset} * interval '1 minute')))`
  if (days.length === 1) {
    conditions.push(sql`${dow} = ${days[0]}`)
  } else {
    conditions.push(sql`${dow} IN (${sql.join(
      days.map((d) => sql`${d}`),
      sql`, `,
    )})`)
  }
}

/** labelIds=1,2,3 или labelId=1 (legacy); сделка должна иметь хотя бы один из лейблов. */
function parseLabelIds(q: Record<string, unknown>): number[] {
  const raw = q.labelIds ?? q.labelId
  const ids: number[] = []
  const add = (v: unknown) => {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0 && !ids.includes(n)) ids.push(n)
  }
  if (Array.isArray(raw)) {
    for (const v of raw) add(v)
  } else if (typeof raw === 'string' && raw.trim()) {
    for (const part of raw.split(',')) add(part.trim())
  } else if (raw != null && raw !== '') {
    add(raw)
  }
  return ids
}

async function appendLabelFilter(db: Db, conditions: SQL[], q: Record<string, unknown>) {
  const labelIds = parseLabelIds(q)
  if (!labelIds.length) return
  const linked = await db
    .select({ tid: tradeLabelLinks.tradeId })
    .from(tradeLabelLinks)
    .where(inArray(tradeLabelLinks.labelId, labelIds))
  const tids = [...new Set(linked.map((x) => x.tid))]
  if (tids.length === 0) {
    conditions.push(sql`1 = 0`)
    return
  }
  conditions.push(inArray(trades.id, tids))
}

/** Общая выборка для `/api/trades` и `/api/trades/infographic` (без `day` — только список с фильтрами). */
export async function queryTradesForList(db: Db, q: Record<string, unknown>): Promise<TradeRow[]> {
  if (q.day && typeof q.day === 'string') {
    const tzOffset = Number(q.tzOffset)
    const { from, to } = Number.isFinite(tzOffset) ? dayBoundsAtOffset(q.day, tzOffset) : localDayBounds(q.day)
    const dayCond: SQL[] = [gte(trades.exitAt, from), lte(trades.exitAt, to)]
    appendAnalysisFilter(dayCond, q)
    appendRrFilter(dayCond, q)
    appendWeekdayFilter(dayCond, q)
    await appendLabelFilter(db, dayCond, q)
    const rows = await db
      .select()
      .from(trades)
      .where(and(...dayCond))
      .orderBy(asc(trades.entryAt), asc(trades.id))
    return selectTradesExcludingMergedOrphans(db, rows)
  }

  const conditions: SQL[] = []

  if (q.side === 'long' || q.side === 'short') {
    conditions.push(eq(trades.side, q.side))
  }
  if (q.tradeSource === 'live' || q.tradeSource === 'test' || q.tradeSource === 'prop') {
    conditions.push(eq(trades.tradeSource, q.tradeSource))
  }
  if (q.accountName && typeof q.accountName === 'string' && q.accountName.trim()) {
    conditions.push(eq(trades.accountName, q.accountName.trim()))
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

  appendAnalysisFilter(conditions, q)
  await appendLabelFilter(db, conditions, q)
  appendRrFilter(conditions, q)
  appendWeekdayFilter(conditions, q)

  const sortDesc = q.sort === 'exit_desc'
  const order = sortDesc ? desc(trades.exitAt) : asc(trades.exitAt)

  const whereExpr = conditions.length ? and(...conditions) : undefined
  const rows = whereExpr
    ? await db.select().from(trades).where(whereExpr).orderBy(order)
    : await db.select().from(trades).orderBy(order)
  return selectTradesExcludingMergedOrphans(db, rows)
}
