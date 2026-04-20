import { useDb } from '../../utils/db'
import { trades } from '../../database/schema'

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
    rr: body.rr != null && body.rr !== '' ? num(body.rr) : null,
    noteSystem: body.noteSystem != null ? String(body.noteSystem) : null,
    noteTechnique: body.noteTechnique != null ? String(body.noteTechnique) : null,
    noteAnalysis: body.noteAnalysis != null ? String(body.noteAnalysis) : null,
    createdAt: now,
    updatedAt: now,
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const row = parseBody(body as Record<string, unknown>)
  const db = useDb()
  const [inserted] = await db.insert(trades).values(row).returning()
  return inserted
})
