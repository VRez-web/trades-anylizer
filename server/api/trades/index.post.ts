import { useDb } from '../../utils/db'
import { trades } from '../../database/schema'
import { parseLabelIds } from '../../utils/labelIdsBody'
import { replaceTradeLabels } from '../../utils/tradeLabels'
import { parseChartMetaBody } from '../../utils/chartProvider'
import { parseTradeSource } from '../../utils/tradeSource'

function parseBody(body: Record<string, unknown>) {
  const symbol = String(body.symbol ?? '')
    .trim()
    .toUpperCase()
  const side = body.side === 'short' ? ('short' as const) : ('long' as const)
  const entryAt = new Date(String(body.entryAt ?? ''))
  const exitAt = new Date(String(body.exitAt ?? ''))
  if (!symbol || Number.isNaN(+entryAt) || Number.isNaN(+exitAt)) {
    throw createError({ statusCode: 400, statusMessage: 'symbol, entryAt, exitAt required' })
  }
  const num = (v: unknown, def = 0) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : def
  }
  const numOrNull = (v: unknown) => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const tradeSource = parseTradeSource(body.tradeSource)
  const accountName = String(body.accountName ?? '').trim()
  const chartMeta = parseChartMetaBody(body, symbol)
  const now = new Date()
  return {
    symbol,
    side,
    entryReasonId: body.entryReasonId != null ? Number(body.entryReasonId) : null,
    exitReasonId: body.exitReasonId != null ? Number(body.exitReasonId) : null,
    entryAt,
    exitAt,
    leverage: num(body.leverage, 1),
    entryPrice: num(body.entryPrice),
    exitPrice: num(body.exitPrice),
    income: num(body.income),
    commission: num(body.commission),
    funding: num(body.funding),
    entryNotionalUsdt: numOrNull(body.entryNotionalUsdt),
    rr: body.rr != null && body.rr !== '' ? num(body.rr) : null,
    noteSystem: body.noteSystem != null ? String(body.noteSystem) : null,
    noteTechnique: body.noteTechnique != null ? String(body.noteTechnique) : null,
    noteAnalysis: body.noteAnalysis != null ? String(body.noteAnalysis) : null,
    noteSystemTs: body.noteSystemTs != null ? String(body.noteSystemTs) : null,
    noteTechniqueTs: body.noteTechniqueTs != null ? String(body.noteTechniqueTs) : null,
    noteAnalysisTs: body.noteAnalysisTs != null ? String(body.noteAnalysisTs) : null,
    tradeSource,
    accountName: tradeSource === 'prop' && accountName ? accountName : null,
    chartSymbol: chartMeta.chartSymbol,
    marketCategory: chartMeta.marketCategory,
    chartProvider: chartMeta.chartProvider,
    createdAt: now,
    updatedAt: now,
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as Record<string, unknown>
  const row = parseBody(body)
  const db = useDb()
  const [inserted] = await db.insert(trades).values(row).returning()
  const packs = parseLabelIds(body)
  if (packs && inserted) await replaceTradeLabels(db, inserted.id, packs)
  return inserted
})
