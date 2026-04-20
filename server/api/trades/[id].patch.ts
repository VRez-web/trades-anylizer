import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const body = await readBody(event) as Record<string, unknown>
  const db = useDb()
  const [existing] = await db.select().from(trades).where(eq(trades.id, id))
  if (!existing) throw createError({ statusCode: 404 })
  const fromSync = Boolean(existing.externalKey)
  if (fromSync) {
    const blocked = [
      'symbol',
      'side',
      'entryAt',
      'exitAt',
      'leverage',
      'entryPrice',
      'exitPrice',
      'income',
      'commission',
      'funding',
    ] as const
    for (const key of blocked) {
      if (key in body && body[key] !== undefined) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Данные с биржи нельзя редактировать',
        })
      }
    }
    const patch2: Record<string, unknown> = { updatedAt: new Date() }
    if ('entryReasonId' in body)
      patch2.entryReasonId =
        body.entryReasonId == null || body.entryReasonId === '' ? null : Number(body.entryReasonId)
    if ('exitReasonId' in body)
      patch2.exitReasonId =
        body.exitReasonId == null || body.exitReasonId === '' ? null : Number(body.exitReasonId)
    if ('rr' in body) patch2.rr = body.rr == null || body.rr === '' ? null : Number(body.rr)
    if ('noteSystem' in body) patch2.noteSystem = body.noteSystem == null ? null : String(body.noteSystem)
    if ('noteTechnique' in body)
      patch2.noteTechnique = body.noteTechnique == null ? null : String(body.noteTechnique)
    if ('noteAnalysis' in body) patch2.noteAnalysis = body.noteAnalysis == null ? null : String(body.noteAnalysis)
    await db.update(trades).set(patch2 as never).where(eq(trades.id, id))
    const [row2] = await db.select().from(trades).where(eq(trades.id, id))
    return row2
  }
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if ('symbol' in body && body.symbol !== undefined) patch.symbol = String(body.symbol).trim().toUpperCase()
  if ('side' in body && body.side !== undefined) patch.side = body.side === 'short' ? 'short' : 'long'
  if ('entryReasonId' in body)
    patch.entryReasonId =
      body.entryReasonId == null || body.entryReasonId === '' ? null : Number(body.entryReasonId)
  if ('exitReasonId' in body)
    patch.exitReasonId =
      body.exitReasonId == null || body.exitReasonId === '' ? null : Number(body.exitReasonId)
  if ('entryAt' in body && body.entryAt !== undefined) patch.entryAt = new Date(String(body.entryAt))
  if ('exitAt' in body && body.exitAt !== undefined) patch.exitAt = new Date(String(body.exitAt))
  if ('leverage' in body && body.leverage !== undefined) patch.leverage = Number(body.leverage)
  if ('entryPrice' in body && body.entryPrice !== undefined) patch.entryPrice = Number(body.entryPrice)
  if ('exitPrice' in body && body.exitPrice !== undefined) patch.exitPrice = Number(body.exitPrice)
  if ('income' in body && body.income !== undefined) patch.income = Number(body.income)
  if ('commission' in body && body.commission !== undefined) patch.commission = Number(body.commission)
  if ('funding' in body && body.funding !== undefined) patch.funding = Number(body.funding)
  if ('rr' in body) patch.rr = body.rr == null || body.rr === '' ? null : Number(body.rr)
  if ('noteSystem' in body) patch.noteSystem = body.noteSystem == null ? null : String(body.noteSystem)
  if ('noteTechnique' in body)
    patch.noteTechnique = body.noteTechnique == null ? null : String(body.noteTechnique)
  if ('noteAnalysis' in body) patch.noteAnalysis = body.noteAnalysis == null ? null : String(body.noteAnalysis)
  await db.update(trades).set(patch as never).where(eq(trades.id, id))
  const [row] = await db.select().from(trades).where(eq(trades.id, id))
  return row
})
