import { displayQuoteVolumeUsdt } from './tradeQuoteVolume'
import {
  durationMs,
  isAnalysisComplete,
  isGeneralAnalysisComplete,
  isTsAnalysisComplete,
  netProfit,
  type TradeRow,
} from './tradeMath'

export type MergedFromLeg = {
  sourceId: number
  entryAt: string
  exitAt: string
  entryPrice: number
  exitPrice: number
}

export type MergedFromParsed = {
  sourceIds: number[]
  legs?: MergedFromLeg[]
}

function parseMergedLeg(raw: unknown): MergedFromLeg | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const sourceId = Number(o.sourceId)
  const entryAt = typeof o.entryAt === 'string' ? o.entryAt : ''
  const exitAt = typeof o.exitAt === 'string' ? o.exitAt : ''
  const entryPrice = Number(o.entryPrice)
  const exitPrice = Number(o.exitPrice)
  if (!Number.isFinite(sourceId) || !entryAt.trim() || !exitAt.trim()) return null
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice)) return null
  if (!Number.isFinite(new Date(entryAt).getTime()) || !Number.isFinite(new Date(exitAt).getTime())) return null
  return { sourceId, entryAt, exitAt, entryPrice, exitPrice }
}

export function parseMergedFrom(raw: string | null | undefined): MergedFromParsed | null {
  if (raw == null || !String(raw).trim()) return null
  try {
    const j = JSON.parse(String(raw)) as { sourceIds?: unknown; legs?: unknown }
    if (!Array.isArray(j.sourceIds)) return null
    const sourceIds = j.sourceIds.filter((x): x is number => Number.isFinite(Number(x))).map(Number)
    if (!sourceIds.length) return null
    const out: MergedFromParsed = { sourceIds }
    if (Array.isArray(j.legs)) {
      const legs = j.legs.map(parseMergedLeg).filter((x): x is MergedFromLeg => x != null)
      if (legs.length) out.legs = legs
    }
    return out
  } catch {
    return null
  }
}

export function serializeTrade(t: TradeRow) {
  return {
    id: t.id,
    externalKey: t.externalKey,
    symbol: t.symbol,
    side: t.side,
    entryReasonId: t.entryReasonId,
    exitReasonId: t.exitReasonId,
    entryAt: t.entryAt.toISOString(),
    exitAt: t.exitAt.toISOString(),
    leverage: t.leverage,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    income: t.income,
    commission: t.commission,
    funding: t.funding,
    rr: t.rr,
    noteSystem: t.noteSystem,
    noteTechnique: t.noteTechnique,
    noteAnalysis: t.noteAnalysis,
    noteSystemTs: t.noteSystemTs,
    noteTechniqueTs: t.noteTechniqueTs,
    noteAnalysisTs: t.noteAnalysisTs,
    mergeGroupId: t.mergeGroupId,
    mergedFrom: parseMergedFrom(t.mergedFrom),
    analysisDone: isAnalysisComplete(t),
    generalAnalysisDone: isGeneralAnalysisComplete(t),
    tsAnalysisDone: isTsAnalysisComplete(t),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    net: netProfit(t),
    durationMs: durationMs(t),
    quoteVolumeUsdt: displayQuoteVolumeUsdt(
      t.entryNotionalUsdt,
      t.side,
      t.entryPrice,
      t.exitPrice,
      t.income,
    ),
  }
}
