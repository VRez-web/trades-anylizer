import { and, eq, inArray } from 'drizzle-orm'
import { labelDefs, tradeLabelLinks } from '../database/schema'
import type { LabelKind } from '../database/schema'
import type { AppDatabase } from '../types/app-database'

type Db = AppDatabase

const KINDS: LabelKind[] = ['system', 'technique', 'psychology']

export async function assertLabelIdsForKinds(db: Db, packs: Record<LabelKind, number[]>) {
  for (const kind of KINDS) {
    const ids = [...new Set(packs[kind].filter((x) => Number.isFinite(x)))]
    if (!ids.length) continue
    const rows = await db.select().from(labelDefs).where(and(eq(labelDefs.kind, kind), inArray(labelDefs.id, ids)))
    if (rows.length !== ids.length) {
      throw createError({ statusCode: 400, statusMessage: 'Неизвестный лейбл или неверный kind' })
    }
  }
}

export async function replaceTradeLabels(
  db: Db,
  tradeId: number,
  packs: Record<LabelKind, number[]>,
) {
  await assertLabelIdsForKinds(db, packs)
  await db.delete(tradeLabelLinks).where(eq(tradeLabelLinks.tradeId, tradeId))
  const rows: { tradeId: number; labelId: number }[] = []
  for (const kind of KINDS) {
    for (const labelId of [...new Set(packs[kind].filter((x) => Number.isFinite(x)))]) {
      rows.push({ tradeId, labelId })
    }
  }
  if (rows.length) await db.insert(tradeLabelLinks).values(rows)
}
