import { trades } from '../database/schema'
import type { InferSelectModel } from 'drizzle-orm'

export type TradeRow = InferSelectModel<typeof trades>

export function netProfit(t: TradeRow) {
  return t.income - t.commission + t.funding
}

export function durationMs(t: TradeRow) {
  return t.exitAt.getTime() - t.entryAt.getTime()
}

export function isAnalysisComplete(t: TradeRow) {
  return (
    (t.noteSystem ?? '').trim().length > 0 &&
    (t.noteTechnique ?? '').trim().length > 0 &&
    (t.noteAnalysis ?? '').trim().length > 0
  )
}
