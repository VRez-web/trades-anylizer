import { sql, and, eq, inArray, like, asc, gte, lte } from 'drizzle-orm'
import { format, getISOWeekYear, getISOWeek } from 'date-fns'
import { trades, reasons, periodNotes, labelDefs, tradeLabelLinks } from '../database/schema'
import type { LabelKind } from '../database/schema'
import { netProfit, type TradeRow } from './tradeMath'
import type { AppDatabase } from '../types/app-database'

type Db = AppDatabase

function netForTrade(row: TradeRow) {
  return netProfit(row)
}

async function listTradesInRange(db: Db, from: Date, to: Date) {
  return db
    .select()
    .from(trades)
    .where(and(gte(trades.exitAt, from), lte(trades.exitAt, to)))
    .orderBy(asc(trades.exitAt))
}

export function exitDateKeyLocal(exitAt: Date) {
  return `${exitAt.getFullYear()}-${String(exitAt.getMonth() + 1).padStart(2, '0')}-${String(exitAt.getDate()).padStart(2, '0')}`
}

export function localMonthBounds(year: number, monthIndex0: number) {
  const from = new Date(year, monthIndex0, 1, 0, 0, 0, 0)
  const to = new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999)
  return { from, to }
}

export function localDayBounds(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) throw new Error('Invalid date')
  const from = new Date(y, m - 1, d, 0, 0, 0, 0)
  const to = new Date(y, m - 1, d, 23, 59, 59, 999)
  return { from, to }
}

export async function calendarMonth(db: Db, year: number, monthIndex0: number) {
  const { from, to } = localMonthBounds(year, monthIndex0)
  const rows = await listTradesInRange(db, from, to)
  const byDay = new Map<string, number>()
  for (const t of rows) {
    const k = exitDateKeyLocal(t.exitAt)
    byDay.set(k, (byDay.get(k) ?? 0) + netForTrade(t))
  }
  return { byDay, from, to, tradesCount: rows.length }
}

export async function calendarMonthJournalFlags(db: Db, year: number, monthIndex1: number) {
  const prefix = `${year}-${String(monthIndex1).padStart(2, '0')}-`
  const rows = await db
    .select({
      periodKey: periodNotes.periodKey,
      content: periodNotes.content,
      tradePlan: periodNotes.tradePlan,
    })
    .from(periodNotes)
    .where(and(eq(periodNotes.scope, 'day'), like(periodNotes.periodKey, `${prefix}%`)))
  const journalByDay: Record<string, { analysis: boolean; plan: boolean }> = {}
  for (const r of rows) {
    journalByDay[r.periodKey] = {
      analysis: r.content.trim().length > 0,
      plan: r.tradePlan.trim().length > 0,
    }
  }
  return journalByDay
}

export async function calendarMonthPeriodFlags(db: Db, year: number, monthIndex0: number) {
  const monthKey = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`
  const { from, to } = localMonthBounds(year, monthIndex0)
  const weekKeys = new Set<string>()
  const cursor = new Date(from)
  while (cursor <= to) {
    weekKeys.add(periodKeyWeek(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  const weekKeysList = Array.from(weekKeys)
  const [monthRows, weekRows] = await Promise.all([
    db
      .select({
        content: periodNotes.content,
      })
      .from(periodNotes)
      .where(and(eq(periodNotes.scope, 'month'), eq(periodNotes.periodKey, monthKey)))
      .limit(1),
    db
      .select({
        periodKey: periodNotes.periodKey,
        content: periodNotes.content,
      })
      .from(periodNotes)
      .where(and(eq(periodNotes.scope, 'week'), inArray(periodNotes.periodKey, weekKeysList))),
  ])
  const monthRow = monthRows[0]
  const monthAnalysis = Boolean(monthRow?.content?.trim().length)
  const weekAnalysisByKey: Record<string, boolean> = {}
  for (const key of weekKeysList) weekAnalysisByKey[key] = false
  for (const r of weekRows) {
    if (r.periodKey in weekAnalysisByKey) {
      weekAnalysisByKey[r.periodKey] = r.content.trim().length > 0
    }
  }
  return { monthAnalysis, weekAnalysisByKey }
}

export async function equitySeries(db: Db) {
  const rows = await db.select().from(trades).orderBy(asc(trades.exitAt))
  let cum = 0
  const points: { t: string; net: number; cumulative: number }[] = []
  for (const t of rows) {
    const n = netForTrade(t)
    cum += n
    points.push({
      t: t.exitAt.toISOString(),
      net: n,
      cumulative: cum,
    })
  }
  return points
}

export async function pnlByLabelInMonth(db: Db, kind: LabelKind, year: number, monthIndex1: number) {
  const { from, to } = localMonthBounds(year, monthIndex1 - 1)
  const netExpr = sql`${trades.income} - ${trades.commission} + ${trades.funding}`
  const rows = await db
    .select({
      labelId: labelDefs.id,
      labelText: labelDefs.label,
      sumNet: sql<number>`coalesce(sum(${netExpr}), 0)`,
    })
    .from(trades)
    .innerJoin(tradeLabelLinks, eq(trades.id, tradeLabelLinks.tradeId))
    .innerJoin(labelDefs, eq(tradeLabelLinks.labelId, labelDefs.id))
    .where(
      and(eq(labelDefs.kind, kind), gte(trades.exitAt, from), lte(trades.exitAt, to)),
    )
    .groupBy(labelDefs.id, labelDefs.label)
  return rows.map((r) => ({
    labelId: r.labelId,
    label: r.labelText,
    sum: r.sumNet,
  }))
}

export async function pnlByReason(db: Db, kind: 'entry' | 'exit') {
  const col = kind === 'entry' ? trades.entryReasonId : trades.exitReasonId
  const netExpr = sql`${trades.income} - ${trades.commission} + ${trades.funding}`
  const rows = await db
    .select({
      reasonId: col,
      sumNet: sql<number>`coalesce(sum(${netExpr}), 0)`,
    })
    .from(trades)
    .groupBy(col)
  const reasonIds = rows.map((r) => r.reasonId).filter((x): x is number => x != null)
  const labels = new Map<number, string>()
  if (reasonIds.length) {
    const rs = await db
      .select()
      .from(reasons)
      .where(and(eq(reasons.kind, kind), inArray(reasons.id, reasonIds)))
    for (const r of rs) labels.set(r.id, r.label)
  }
  return rows
    .filter((r) => r.reasonId != null)
    .map((r) => ({
      reasonId: r.reasonId,
      label: labels.get(r.reasonId!) ?? `#${r.reasonId}`,
      sum: r.sumNet,
    }))
}

export function aggregateTrades(list: TradeRow[]) {
  let wins = 0
  let losses = 0
  let longCount = 0
  let shortCount = 0
  let netProfitSum = 0
  let commission = 0
  let funding = 0
  let levSum = 0
  for (const t of list) {
    const n = netForTrade(t)
    if (n > 0) wins++
    else if (n < 0) losses++
    if (t.side === 'long') longCount++
    else shortCount++
    netProfitSum += n
    commission += t.commission
    funding += t.funding
    levSum += t.leverage
  }
  const c = list.length
  return {
    wins,
    losses,
    longCount,
    shortCount,
    netProfit: netProfitSum,
    commission,
    funding,
    avgLeverage: c ? levSum / c : 0,
  }
}

export function periodKeyWeek(d: Date) {
  const y = getISOWeekYear(d)
  const w = getISOWeek(d)
  return `${y}-W${String(w).padStart(2, '0')}`
}

export function periodKeyMonth(d: Date) {
  return format(d, 'yyyy-MM')
}
