import { eq, inArray } from 'drizzle-orm'
import type { AppDatabase } from '../types/app-database'
import { labelDefs, tradeLabelLinks, trades } from '../database/schema'
import { netProfit, type TradeRow } from './tradeMath'

export type JournalSummaryRow = { key: string; count: number; sum: number }

export type SideWinRatePack = {
  total: number
  wins: number
  losses: number
  winRate: number | null
  net: number
}

export function sideWinRateStats(list: TradeRow[]): { long: SideWinRatePack; short: SideWinRatePack } {
  const pack = (side: 'long' | 'short'): SideWinRatePack => {
    const rows = list.filter((t) => t.side === side)
    const wins = rows.filter((t) => netProfit(t) > 0).length
    const losses = rows.filter((t) => netProfit(t) < 0).length
    const net = rows.reduce((s, t) => s + netProfit(t), 0)
    return {
      total: rows.length,
      wins,
      losses,
      winRate: rows.length ? wins / rows.length : null,
      net,
    }
  }
  return { long: pack('long'), short: pack('short') }
}

export function symbolSummary(list: TradeRow[]): JournalSummaryRow[] {
  const m = new Map<string, { count: number; sum: number }>()
  for (const t of list) {
    const cur = m.get(t.symbol) ?? { count: 0, sum: 0 }
    cur.count += 1
    cur.sum += netProfit(t)
    m.set(t.symbol, cur)
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, count: v.count, sum: v.sum }))
    .sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum))
}

export function labelSummaryFromTrades(
  list: TradeRow[],
  linksByTrade: Map<number, { kind: string; label: string }[]>,
): JournalSummaryRow[] {
  const agg = new Map<string, { count: number; sum: number }>()
  for (const t of list) {
    const net = netProfit(t)
    const labels = linksByTrade.get(t.id) ?? []
    if (!labels.length) {
      const k = '— без лейблов'
      const cur = agg.get(k) ?? { count: 0, sum: 0 }
      cur.count += 1
      cur.sum += net
      agg.set(k, cur)
      continue
    }
    for (const lb of labels) {
      const k = `[${lb.kind}] ${lb.label}`
      const cur = agg.get(k) ?? { count: 0, sum: 0 }
      cur.count += 1
      cur.sum += net
      agg.set(k, cur)
    }
  }
  return [...agg.entries()]
    .map(([key, v]) => ({ key, count: v.count, sum: v.sum }))
    .sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum))
}

export async function fetchTradeLabelLinks(db: AppDatabase, tradeIds: number[]) {
  const linksByTrade = new Map<number, { kind: string; label: string }[]>()
  if (!tradeIds.length) return linksByTrade

  const rows = await db
    .select({
      tradeId: tradeLabelLinks.tradeId,
      kind: labelDefs.kind,
      label: labelDefs.label,
    })
    .from(trades)
    .innerJoin(tradeLabelLinks, eq(trades.id, tradeLabelLinks.tradeId))
    .innerJoin(labelDefs, eq(tradeLabelLinks.labelId, labelDefs.id))
    .where(inArray(trades.id, tradeIds))

  for (const row of rows) {
    const cur = linksByTrade.get(row.tradeId) ?? []
    cur.push({ kind: row.kind, label: row.label })
    linksByTrade.set(row.tradeId, cur)
  }
  return linksByTrade
}
