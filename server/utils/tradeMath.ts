import { trades } from '../database/schema'
import type { InferSelectModel } from 'drizzle-orm'

export type TradeRow = InferSelectModel<typeof trades>

export function netProfit(t: TradeRow) {
  return t.income - t.commission + t.funding
}

export function durationMs(t: TradeRow) {
  return t.exitAt.getTime() - t.entryAt.getTime()
}

function tripletFilled(
  a: string | null | undefined,
  b: string | null | undefined,
  c: string | null | undefined,
) {
  return (
    (a ?? '').trim().length > 0 &&
    (b ?? '').trim().length > 0 &&
    (c ?? '').trim().length > 0
  )
}

/** Блок ТС: три поля подряд или одна общая textarea (только note_analysis_ts). */
function tsBlockFilled(t: TradeRow) {
  if (tripletFilled(t.noteSystemTs, t.noteTechniqueTs, t.noteAnalysisTs)) return true
  const s = (t.noteSystemTs ?? '').trim()
  const tech = (t.noteTechniqueTs ?? '').trim()
  const psy = (t.noteAnalysisTs ?? '').trim()
  return s === '' && tech === '' && psy.length > 0
}

/** Заполнен блок «общий» (система / техника / психология). */
export function isGeneralAnalysisComplete(t: TradeRow) {
  return tripletFilled(t.noteSystem, t.noteTechnique, t.noteAnalysis)
}

/** Заполнен блок «ТС». */
export function isTsAnalysisComplete(t: TradeRow) {
  return tsBlockFilled(t)
}

/** Заполнен блок «общий» или блок «ТС» (оба набора полей независимы). */
export function isAnalysisComplete(t: TradeRow) {
  return isGeneralAnalysisComplete(t) || isTsAnalysisComplete(t)
}
