import { displayQuoteVolumeUsdt } from './tradeQuoteVolume'
import { durationMs, isAnalysisComplete, netProfit, type TradeRow } from './tradeMath'

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
    analysisDone: isAnalysisComplete(t),
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
