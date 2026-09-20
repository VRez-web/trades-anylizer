import { useDb } from '../../../utils/db'
import { propEvents, type PropEventKind } from '../../../database/schema'
import { allocatePropAccountName } from '../../../utils/propAccounts'
import { serializePropEvent } from '../../../utils/propCashflow'

function parseKind(v: unknown): PropEventKind {
  return v === 'payout' ? 'payout' : 'purchase'
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as Record<string, unknown>
  const accountName = String(body.accountName ?? '').trim()
  const amountUsdt = Math.abs(Number(body.amountUsdt))
  const eventAt = new Date(String(body.eventAt ?? ''))
  if (!accountName || !Number.isFinite(amountUsdt) || amountUsdt <= 0 || Number.isNaN(+eventAt)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'accountName, amountUsdt (>0), eventAt required',
    })
  }
  const now = new Date()
  const db = useDb()
  const kind = parseKind(body.kind)
  /** Покупка на занятое имя всегда новый экземпляр (#2), иначе второй проп схлопывается. */
  const resolvedName = await allocatePropAccountName(db, accountName, kind === 'purchase')
  const [row] = await db
    .insert(propEvents)
    .values({
      kind,
      accountName: resolvedName,
      amountUsdt,
      eventAt,
      note: body.note != null && String(body.note).trim() ? String(body.note).trim() : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return serializePropEvent(row)
})
