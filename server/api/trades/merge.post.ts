import { eq, inArray } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades, labelDefs, tradeLabelLinks } from '../../database/schema'
import { exitDateKeyLocal } from '../../utils/stats'
import { buildMergedTradePayload } from '../../utils/mergeTradeAggregate'
import { replaceTradeLabels } from '../../utils/tradeLabels'
import type { LabelKind } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { tradeIds?: unknown }
  const raw = Array.isArray(body.tradeIds) ? body.tradeIds : []
  const ids = [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))]
  if (ids.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Нужно минимум 2 сделки' })
  }
  const db = useDb()
  const rows = await db.select().from(trades).where(inArray(trades.id, ids))
  if (rows.length !== ids.length) throw createError({ statusCode: 404, statusMessage: 'Не все сделки найдены' })

  const sym = rows[0].symbol
  const side = rows[0].side
  for (const r of rows) {
    if (r.symbol !== sym) {
      throw createError({ statusCode: 400, statusMessage: 'Объединять можно только сделки по одному тикеру' })
    }
    if (r.side !== side) {
      throw createError({ statusCode: 400, statusMessage: 'Все сделки должны быть одной стороны (long или short)' })
    }
    if (r.mergeGroupId != null) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Сделка в старой группе: нажмите «Разъединить», затем объедините снова',
      })
    }
    if (r.mergedFrom != null) {
      throw createError({ statusCode: 400, statusMessage: 'Нельзя объединять уже объединённую сделку' })
    }
  }

  const days = new Set(rows.map((r) => exitDateKeyLocal(r.exitAt)))
  if (days.size !== 1) {
    throw createError({ statusCode: 400, statusMessage: 'Все сделки должны быть с выходом в один календарный день' })
  }

  const linkRows = await db
    .select({ kind: labelDefs.kind, id: labelDefs.id })
    .from(tradeLabelLinks)
    .innerJoin(labelDefs, eq(tradeLabelLinks.labelId, labelDefs.id))
    .where(inArray(tradeLabelLinks.tradeId, ids))

  const labelPacks: Record<LabelKind, number[]> = {
    system: [],
    technique: [],
    psychology: [],
  }
  for (const r of linkRows) {
    if (!labelPacks[r.kind].includes(r.id)) labelPacks[r.kind].push(r.id)
  }

  const now = new Date()
  const payload = buildMergedTradePayload(rows, now)

  /** better-sqlite3: `db.transaction(async () => …)` запрещён — колбэк должен быть синхронным. Делаем шаги по очереди. */
  const [inserted] = await db
    .insert(trades)
    .values({
      externalKey: payload.externalKey,
      symbol: payload.symbol,
      side: payload.side,
      entryReasonId: null,
      exitReasonId: null,
      entryAt: payload.entryAt,
      exitAt: payload.exitAt,
      leverage: payload.leverage,
      entryPrice: payload.entryPrice,
      exitPrice: payload.exitPrice,
      income: payload.income,
      commission: payload.commission,
      funding: payload.funding,
      entryNotionalUsdt: payload.entryNotionalUsdt,
      rr: null,
      noteSystem: payload.noteSystem,
      noteTechnique: payload.noteTechnique,
      noteAnalysis: payload.noteAnalysis,
      noteSystemTs: payload.noteSystemTs,
      noteTechniqueTs: payload.noteTechniqueTs,
      noteAnalysisTs: payload.noteAnalysisTs,
      mergeGroupId: null,
      mergedFrom: payload.mergedFrom,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    })
    .returning()
  if (!inserted) throw createError({ statusCode: 500 })
  await replaceTradeLabels(db, inserted.id, labelPacks)
  await db.delete(trades).where(inArray(trades.id, ids))

  return { ok: true, tradeId: inserted.id }
})
