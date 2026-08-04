import { asc, eq } from 'drizzle-orm'
import { propEvents, trades, type PropEventKind } from '../database/schema'
import type { AppDatabase } from '../types/app-database'
import { selectTradesExcludingMergedOrphans } from './mergedTradeSync'
import { netProfit, type TradeRow } from './tradeMath'

type Db = AppDatabase

export function signedPropEventAmount(kind: PropEventKind, amountUsdt: number) {
  const n = Math.abs(amountUsdt)
  return kind === 'purchase' ? -n : n
}

export function serializePropEvent(row: typeof propEvents.$inferSelect) {
  const signed = signedPropEventAmount(row.kind as PropEventKind, row.amountUsdt)
  return {
    id: row.id,
    kind: row.kind as PropEventKind,
    accountName: row.accountName,
    amountUsdt: row.amountUsdt,
    signedUsdt: signed,
    eventAt: row.eventAt.toISOString(),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function isLiveEquityTrade(t: TradeRow) {
  return t.tradeSource !== 'prop'
}

export async function propCashflowSeries(db: Db) {
  const rows = await db.select().from(propEvents).orderBy(asc(propEvents.eventAt), asc(propEvents.id))
  let cum = 0
  return rows.map((r) => {
    const net = signedPropEventAmount(r.kind as PropEventKind, r.amountUsdt)
    cum += net
    return {
      t: r.eventAt.toISOString(),
      net,
      cumulative: cum,
      kind: r.kind,
      accountName: r.accountName,
    }
  })
}

export async function propSummary(db: Db) {
  const events = await db.select().from(propEvents).orderBy(asc(propEvents.eventAt))
  let purchasesTotal = 0
  let payoutsTotal = 0
  for (const e of events) {
    const n = Math.abs(e.amountUsdt)
    if (e.kind === 'purchase') purchasesTotal += n
    else payoutsTotal += n
  }

  const rawTrades = await db.select().from(trades).where(eq(trades.tradeSource, 'prop')).orderBy(asc(trades.exitAt))
  const propTrades = await selectTradesExcludingMergedOrphans(db, rawTrades)
  const tradesNet = propTrades.reduce((s, t) => s + netProfit(t), 0)

  return {
    purchasesTotal,
    payoutsTotal,
    netCashflow: payoutsTotal - purchasesTotal,
    tradesNet,
    combinedNet: payoutsTotal - purchasesTotal + tradesNet,
    eventsCount: events.length,
    tradesCount: propTrades.length,
  }
}
