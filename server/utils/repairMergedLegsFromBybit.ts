import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { trades } from '../database/schema'
import { useDb } from './db'
import type { TradeRow } from './tradeMath'
import {
  BybitGeoBlockedError,
  fetchAllClosedPnl,
  positionSideFromCloseOrder,
  resolveBybitCredentials,
  resolveBybitHttpProxy,
  bybitBaseUrl,
} from './bybitCredentials'
import { parseMergedFrom, type MergedFromLeg } from './serialize'

type LegCandidate = {
  entryAt: Date
  exitAt: Date
  entryPrice: number
  exitPrice: number
  closedPnl: number
  entryMs: number
}

function str(row: Record<string, unknown>, k: string): string {
  const v = row[k]
  return v == null ? '' : String(v)
}

function parseClosedPnlRow(row: Record<string, unknown>): LegCandidate | null {
  const entryPrice = parseFloat(str(row, 'avgEntryPrice'))
  const exitPrice = parseFloat(str(row, 'avgExitPrice'))
  const closedPnl = parseFloat(str(row, 'closedPnl'))
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice) || !Number.isFinite(closedPnl)) return null
  const ct = Number(str(row, 'createdTime'))
  const ut = Number(str(row, 'updatedTime'))
  let entryMs = Number.isFinite(ct) ? ct : ut
  let exitMs = Number.isFinite(ut) ? ut : entryMs
  if (entryMs > exitMs) {
    const s = entryMs
    entryMs = exitMs
    exitMs = s
  }
  if (entryMs === exitMs) exitMs = entryMs + 1000
  return {
    entryAt: new Date(entryMs),
    exitAt: new Date(exitMs),
    entryPrice,
    exitPrice,
    closedPnl,
    entryMs,
  }
}

function incomeMatches(sumPnl: number, tradeIncome: number): boolean {
  const tol = Math.max(1e-5, Math.abs(tradeIncome) * 1e-6)
  return Math.abs(sumPnl - tradeIncome) <= tol
}

function sumPnl(arr: LegCandidate[]): number {
  return arr.reduce((s, x) => s + x.closedPnl, 0)
}

/** n choose k, k <= 12 и arr.length ограничен снаружи. */
function combinationsOfSize<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  const out: T[][] = []
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i]!
    for (const rest of combinationsOfSize(arr.slice(i + 1), k - 1)) {
      out.push([head, ...rest])
    }
  }
  return out
}

const MAX_FOR_COMBINATORICS = 18

function pickLegsFromCandidates(
  candidates: LegCandidate[],
  n: number,
  tradeIncome: number,
): LegCandidate[] | null {
  if (candidates.length < n) return null
  if (candidates.length === n) {
    const sorted = [...candidates].sort((a, b) => a.entryMs - b.entryMs)
    return incomeMatches(sumPnl(sorted), tradeIncome) ? sorted : null
  }
  if (candidates.length > MAX_FOR_COMBINATORICS) return null
  const combos = combinationsOfSize(candidates, n)
  const hits: LegCandidate[][] = []
  for (const c of combos) {
    if (incomeMatches(sumPnl(c), tradeIncome)) hits.push([...c].sort((a, b) => a.entryMs - b.entryMs))
  }
  if (hits.length !== 1) return null
  return hits[0]!
}

function filterRowsForTrade(
  rows: Record<string, unknown>[],
  symbol: string,
  side: 'long' | 'short',
): LegCandidate[] {
  const seen = new Set<string>()
  const out: LegCandidate[] = []
  for (const row of rows) {
    if (str(row, 'symbol') !== symbol) continue
    const ps = positionSideFromCloseOrder(str(row, 'side'))
    if (ps !== side) continue
    const oid = str(row, 'orderId')
    const ut = str(row, 'updatedTime')
    const key = `${oid}:${ut}`
    if (seen.has(key)) continue
    seen.add(key)
    const leg = parseClosedPnlRow(row)
    if (leg) out.push(leg)
  }
  return out
}

function buildMergedFromJson(sourceIds: number[], legsSorted: LegCandidate[]): string {
  const idsSorted = [...sourceIds].sort((a, b) => a - b)
  const legs: MergedFromLeg[] = legsSorted.map((leg, i) => ({
    sourceId: idsSorted[i] ?? idsSorted[idsSorted.length - 1] ?? 0,
    entryAt: leg.entryAt.toISOString(),
    exitAt: leg.exitAt.toISOString(),
    entryPrice: leg.entryPrice,
    exitPrice: leg.exitPrice,
  }))
  return JSON.stringify({ sourceIds, legs })
}

async function tryRepairForCategory(
  apiKey: string,
  apiSecret: string,
  baseUrl: string,
  proxyUrl: string | undefined,
  category: string,
  trade: TradeRow,
  sourceIds: number[],
  n: number,
  startTime: number,
  endTime: number,
): Promise<string | null> {
  const list = (await fetchAllClosedPnl(apiKey, apiSecret, {
    baseUrl,
    category,
    startTime,
    endTime,
    proxyUrl,
  })) as Record<string, unknown>[]
  const candidates = filterRowsForTrade(list, trade.symbol, trade.side)
  candidates.sort((a, b) => a.entryMs - b.entryMs)
  const picked = pickLegsFromCandidates(candidates, n, trade.income)
  if (!picked || picked.length !== n) return null
  return buildMergedFromJson(sourceIds, picked)
}

/**
 * Для старых merge без `legs` в JSON: подставляем ноги из Bybit closed-pnl по окну времени и совпадению суммы PnL.
 * При успехе обновляет строку в БД и возвращает актуальный TradeRow.
 */
export async function repairMergedLegsIfNeeded(
  event: H3Event,
  db: ReturnType<typeof useDb>,
  trade: TradeRow,
): Promise<TradeRow | null> {
  const merged = parseMergedFrom(trade.mergedFrom)
  if (!merged?.sourceIds?.length || (merged.legs?.length ?? 0) > 0) return null

  const config = useRuntimeConfig(event)
  const { apiKey, apiSecret, testnet } = resolveBybitCredentials(config)
  if (!apiKey || !apiSecret) return null

  const proxyUrl = resolveBybitHttpProxy(config)
  const baseUrl = bybitBaseUrl(testnet)
  const n = merged.sourceIds.length
  const entryMs = trade.entryAt.getTime()
  const exitMs = trade.exitAt.getTime()
  const pad5m = 5 * 60 * 1000
  const pad24h = 24 * 60 * 60 * 1000

  const windows: [number, number][] = [
    [entryMs - pad5m, exitMs + pad5m],
    [entryMs - pad24h, exitMs + pad24h],
  ]

  let newJson: string | null = null

  try {
    for (const [startTime, endTime] of windows) {
      for (const category of ['linear', 'inverse'] as const) {
        newJson = await tryRepairForCategory(
          apiKey,
          apiSecret,
          baseUrl,
          proxyUrl,
          category,
          trade,
          merged.sourceIds,
          n,
          startTime,
          endTime,
        )
        if (newJson) break
      }
      if (newJson) break
    }
  } catch (e) {
    if (e instanceof BybitGeoBlockedError) return null
    if (import.meta.dev) console.warn('[repairMergedLegs]', e)
    return null
  }

  if (!newJson) return null

  const now = new Date()
  await db.update(trades).set({ mergedFrom: newJson, updatedAt: now }).where(eq(trades.id, trade.id))
  const [fresh] = await db.select().from(trades).where(eq(trades.id, trade.id))
  return fresh ?? null
}
