import type { TradeRow } from './tradeMath'

function mergeNoteField(rows: TradeRow[], pick: (r: TradeRow) => string | null): string | null {
  const parts: string[] = []
  for (const r of rows) {
    const s = (pick(r) ?? '').trim()
    if (s) parts.push(`Сделка #${r.id}:\n${s}`)
  }
  return parts.length ? parts.join('\n\n---\n\n') : null
}

export type MergedTradePayload = {
  symbol: string
  side: 'long' | 'short'
  entryAt: Date
  exitAt: Date
  leverage: number
  entryPrice: number
  exitPrice: number
  income: number
  commission: number
  funding: number
  entryNotionalUsdt: number | null
  rr: null
  noteSystem: string | null
  noteTechnique: string | null
  noteAnalysis: string | null
  noteSystemTs: string | null
  noteTechniqueTs: string | null
  noteAnalysisTs: string | null
  externalKey: string
  mergedFrom: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Одна сделка из нескольких: время входа — самый ранний вход, выход — самый поздний выход;
 * цены и плечо — средневзвешенные по entry notional (USDT), если есть хотя бы у одной ноги суммарно > 0, иначе равные веса;
 * доход/комиссия/фандинг — суммы; заметки — склейка с пометкой исходного id.
 */
export function buildMergedTradePayload(rows: TradeRow[], now: Date): MergedTradePayload {
  const sym = rows[0].symbol
  const side = rows[0].side
  const entryAt = new Date(Math.min(...rows.map((r) => r.entryAt.getTime())))
  const exitAt = new Date(Math.max(...rows.map((r) => r.exitAt.getTime())))

  const income = rows.reduce((s, r) => s + r.income, 0)
  const commission = rows.reduce((s, r) => s + r.commission, 0)
  const funding = rows.reduce((s, r) => s + r.funding, 0)

  const weights = rows.map((r) => {
    const n = r.entryNotionalUsdt
    return Number.isFinite(n as number) && n != null && n > 0 ? n : 0
  })
  const wsum = weights.reduce((a, b) => a + b, 0)
  const useNotional = wsum > 0
  const n = rows.length
  let ep = 0
  let xp = 0
  let lv = 0
  rows.forEach((r, i) => {
    const w = useNotional ? weights[i] : 1
    ep += r.entryPrice * w
    xp += r.exitPrice * w
    lv += r.leverage * w
  })
  const wf = useNotional ? wsum : n
  const entryPrice = ep / wf
  const exitPrice = xp / wf
  const leverage = lv / wf

  const sumNotional = rows.reduce((s, r) => {
    const v = r.entryNotionalUsdt
    return s + (Number.isFinite(v as number) && v != null && v > 0 ? v : 0)
  }, 0)
  const entryNotionalUsdt = sumNotional > 0 ? sumNotional : null

  const sourceIds = [...rows.map((r) => r.id)].sort((a, b) => a - b)
  const legs = [...rows]
    .map((r) => ({
      sourceId: r.id,
      entryAt: r.entryAt.toISOString(),
      exitAt: r.exitAt.toISOString(),
      entryPrice: r.entryPrice,
      exitPrice: r.exitPrice,
    }))
    .sort((a, b) => new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime())
  const mergedFrom = JSON.stringify({ sourceIds, legs })
  const externalKey = `merged:${sourceIds.join(':')}`

  const createdAt = new Date(Math.min(...rows.map((r) => r.createdAt.getTime())))

  return {
    symbol: sym,
    side,
    entryAt,
    exitAt,
    leverage,
    entryPrice,
    exitPrice,
    income,
    commission,
    funding,
    entryNotionalUsdt,
    rr: null,
    noteSystem: mergeNoteField(rows, (r) => r.noteSystem),
    noteTechnique: mergeNoteField(rows, (r) => r.noteTechnique),
    noteAnalysis: mergeNoteField(rows, (r) => r.noteAnalysis),
    noteSystemTs: mergeNoteField(rows, (r) => r.noteSystemTs),
    noteTechniqueTs: mergeNoteField(rows, (r) => r.noteTechniqueTs),
    noteAnalysisTs: mergeNoteField(rows, (r) => r.noteAnalysisTs),
    externalKey,
    mergedFrom,
    createdAt,
    updatedAt: now,
  }
}
