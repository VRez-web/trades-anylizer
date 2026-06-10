import { and, eq, isNotNull, isNull, like, or } from 'drizzle-orm'
import { trades } from '../database/schema'
import type { AppDatabase } from '../types/app-database'
import type { TradeRow } from './tradeMath'
import { closedPnlToExternalKey } from './bybitCredentials'
import { parseMergedFrom, type MergedFromLeg, type MergedFromParsed } from './serialize'
import {
  filterRowsForTrade,
  parseClosedPnlRow,
  pickLegsFromCandidates,
  type LegCandidate,
} from './repairMergedLegsFromBybit'

export type MergedFromPayload = MergedFromParsed & {
  sourceExternalKeys?: string[]
}

export function buildMergedFromJson(
  sourceIds: number[],
  legs: { sourceId: number; entryAt: string; exitAt: string; entryPrice: number; exitPrice: number }[],
  sourceExternalKeys: string[],
): string {
  const payload: MergedFromPayload = {
    sourceIds,
    legs,
    ...(sourceExternalKeys.length ? { sourceExternalKeys } : {}),
  }
  return JSON.stringify(payload)
}

export function sourceExternalKeysFromRows(rows: TradeRow[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const k = r.externalKey?.trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

function legMatchesRow(leg: LegCandidate, row: Record<string, string>): boolean {
  const parsed = parseClosedPnlRow(row)
  if (!parsed) return false
  const tol = 2000
  return (
    Math.abs(parsed.entryMs - leg.entryMs) <= tol &&
    Math.abs(parsed.entryPrice - leg.entryPrice) <= 1e-6 &&
    Math.abs(parsed.exitPrice - leg.exitPrice) <= 1e-6
  )
}

function keysForPickedLegs(
  picked: LegCandidate[],
  list: Record<string, string>[],
  category: string,
): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const leg of picked) {
    const raw = list.find((r) => legMatchesRow(leg, r))
    if (!raw) continue
    const key = closedPnlToExternalKey(
      { orderId: raw.orderId ?? '', updatedTime: raw.updatedTime ?? '' },
      category,
    )
    if (!seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
  }
  return keys
}

/** Подобрать Bybit external_key для уже объединённой сделки без sourceExternalKeys. */
export function inferSourceExternalKeysFromBybitList(
  trade: TradeRow,
  merged: MergedFromParsed,
  list: Record<string, string>[],
  category: string,
): string[] | null {
  const n = merged.sourceIds.length
  if (!n) return null
  const candidates = filterRowsForTrade(
    list as unknown as Record<string, unknown>[],
    trade.symbol,
    trade.side,
  )
  const picked = pickLegsFromCandidates(candidates, n, trade.income)
  if (!picked || picked.length !== n) return null
  const keys = keysForPickedLegs(picked, list, category)
  return keys.length === n ? keys : null
}

const TIME_MATCH_MS = 60_000
const PRICE_REL_TOL = 1e-4

export function tradeMatchesMergedLeg(
  trade: TradeRow,
  mergedParent: TradeRow,
  leg: MergedFromLeg,
): boolean {
  if (trade.symbol !== mergedParent.symbol || trade.side !== mergedParent.side) return false
  const entryT = new Date(leg.entryAt).getTime()
  const exitT = new Date(leg.exitAt).getTime()
  if (!Number.isFinite(entryT) || !Number.isFinite(exitT)) return false
  const epTol = Math.max(1e-8, Math.abs(leg.entryPrice) * PRICE_REL_TOL)
  const xpTol = Math.max(1e-8, Math.abs(leg.exitPrice) * PRICE_REL_TOL)
  return (
    Math.abs(trade.entryAt.getTime() - entryT) <= TIME_MATCH_MS &&
    Math.abs(trade.exitAt.getTime() - exitT) <= TIME_MATCH_MS &&
    Math.abs(trade.entryPrice - leg.entryPrice) <= epTol &&
    Math.abs(trade.exitPrice - leg.exitPrice) <= xpTol
  )
}

/** Сделка — повторно импортированная нога уже объединённой позиции. */
export function isOrphanOfMergedTrade(
  trade: TradeRow,
  mergedParent: TradeRow,
  parsed: MergedFromParsed,
): boolean {
  if (trade.id === mergedParent.id) return false
  if (trade.mergedFrom) return false
  const ext = trade.externalKey?.trim()
  if (ext && parsed.sourceExternalKeys?.includes(ext)) return true
  if (parsed.legs?.length) {
    return parsed.legs.some((leg) => tradeMatchesMergedLeg(trade, mergedParent, leg))
  }
  return false
}

export function filterTradesExcludingMergedOrphans(
  rows: TradeRow[],
  mergedParents: TradeRow[],
): TradeRow[] {
  if (!mergedParents.length) return rows
  const parsedList = mergedParents
    .map((m) => ({ m, parsed: parseMergedFrom(m.mergedFrom) }))
    .filter((x): x is { m: TradeRow; parsed: MergedFromParsed } => x.parsed != null)
  if (!parsedList.length) return rows
  return rows.filter((t) => {
    for (const { m, parsed } of parsedList) {
      if (isOrphanOfMergedTrade(t, m, parsed)) return false
    }
    return true
  })
}

function isMissingMergedFromColumn(e: unknown): boolean {
  const msg = String(e ?? '')
  const code = (e as { code?: string })?.code
  return (
    code === '42703' ||
    /column .*merged_from.* does not exist/i.test(msg) ||
    /merged_from/i.test(msg) && /does not exist/i.test(msg)
  )
}

/** Объединённые сделки: merged_from IS NOT NULL или external_key merged:… */
export async function loadMergedParentTrades(db: AppDatabase): Promise<TradeRow[]> {
  try {
    return await db
      .select()
      .from(trades)
      .where(or(isNotNull(trades.mergedFrom), like(trades.externalKey, 'merged:%')))
  } catch (e) {
    if (isMissingMergedFromColumn(e)) {
      console.warn('[mergedTradeSync] column merged_from missing, fallback to external_key merged:%')
      return db.select().from(trades).where(like(trades.externalKey, 'merged:%'))
    }
    throw e
  }
}

/** Удалить из БД повторно импортированные ноги объединённых сделок. */
export async function cleanupAllMergedOrphans(db: AppDatabase): Promise<number> {
  const mergedParents = await loadMergedParentTrades(db)
  if (!mergedParents.length) return 0

  const orphanCond = and(like(trades.externalKey, 'bybit:%'), isNull(trades.mergedFrom))
  let candidates: TradeRow[]
  try {
    candidates = await db.select().from(trades).where(orphanCond)
  } catch (e) {
    if (isMissingMergedFromColumn(e)) {
      candidates = await db.select().from(trades).where(like(trades.externalKey, 'bybit:%'))
    } else {
      throw e
    }
  }

  let removed = 0
  for (const t of candidates) {
    for (const m of mergedParents) {
      const parsed = parseMergedFrom(m.mergedFrom)
      if (!parsed) continue
      if (isOrphanOfMergedTrade(t, m, parsed)) {
        await db.delete(trades).where(eq(trades.id, t.id))
        removed++
        break
      }
    }
  }
  return removed
}

export type MergeGuardResult = {
  suppressed: Set<string>
  backfilled: number
}

/**
 * Собрать ключи исходных ног объединённых сделок; при отсутствии — восстановить из списка Bybit.
 * Эти ключи не должны снова импортироваться отдельными сделками.
 */
export async function ensureMergedTradeGuards(
  db: AppDatabase,
  bybitList: Record<string, string>[],
  category: string,
): Promise<MergeGuardResult> {
  const mergedRows = await loadMergedParentTrades(db)

  const suppressed = new Set<string>()
  let backfilled = 0
  const now = new Date()

  for (const trade of mergedRows) {
    const parsed = parseMergedFrom(trade.mergedFrom) as MergedFromPayload | null
    if (!parsed) continue

    let keys = parsed.sourceExternalKeys ?? []
    if (!keys.length) {
      const inferred = inferSourceExternalKeysFromBybitList(trade, parsed, bybitList, category)
      if (inferred?.length) {
        keys = inferred
        const mergedFrom = buildMergedFromJson(
          parsed.sourceIds,
          parsed.legs ?? [],
          keys,
        )
        await db.update(trades).set({ mergedFrom, updatedAt: now }).where(eq(trades.id, trade.id))
        backfilled++
      }
    }
    for (const k of keys) suppressed.add(k)
  }

  return { suppressed, backfilled }
}

/** Выборка сделок без «сирот» объединённых ног (для списков и статистики). */
export async function selectTradesExcludingMergedOrphans(
  db: AppDatabase,
  rows: TradeRow[],
): Promise<TradeRow[]> {
  try {
    const mergedParents = await loadMergedParentTrades(db)
    return filterTradesExcludingMergedOrphans(rows, mergedParents)
  } catch (e) {
    console.error('[mergedTradeSync] orphan filter skipped', e)
    return rows
  }
}

/** Синк Bybit: не ронять запрос, если защита merge недоступна. */
export async function runMergedTradeSyncGuards(
  db: AppDatabase,
  bybitList: Record<string, string>[],
  category: string,
): Promise<{
  suppressed: Set<string>
  backfilled: number
  removedOrphans: number
  guardsFailed: boolean
}> {
  try {
    const removedOrphans = await cleanupAllMergedOrphans(db)
    const { suppressed, backfilled } = await ensureMergedTradeGuards(db, bybitList, category)
    const removedAfter = await cleanupAllMergedOrphans(db)
    return {
      suppressed,
      backfilled,
      removedOrphans: removedOrphans + removedAfter,
      guardsFailed: false,
    }
  } catch (e) {
    console.error('[mergedTradeSync] sync guards failed', e)
    return {
      suppressed: new Set<string>(),
      backfilled: 0,
      removedOrphans: 0,
      guardsFailed: true,
    }
  }
}
