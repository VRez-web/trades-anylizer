import { eq } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { propEvents, type PropEventKind } from '../../../database/schema'
import { allocatePropAccountName } from '../../../utils/propAccounts'
import { serializePropEvent } from '../../../utils/propCashflow'

function parseKind(v: unknown): PropEventKind | undefined {
  if (v === 'purchase' || v === 'payout') return v
  return undefined
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400 })
  const body = await readBody(event) as Record<string, unknown>
  const db = useDb()
  const [existing] = await db.select().from(propEvents).where(eq(propEvents.id, id))
  if (!existing) throw createError({ statusCode: 404 })

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if ('kind' in body && body.kind !== undefined) {
    const kind = parseKind(body.kind)
    if (!kind) throw createError({ statusCode: 400, statusMessage: 'kind: purchase | payout' })
    patch.kind = kind
  }
  if (body.splitInstance === true) {
    const next = await allocatePropAccountName(db, existing.accountName, true)
    patch.accountName = next
  } else if ('accountName' in body && body.accountName !== undefined) {
    const name = String(body.accountName).trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'accountName required' })
    patch.accountName = name
  }
  if ('amountUsdt' in body && body.amountUsdt !== undefined) {
    const n = Math.abs(Number(body.amountUsdt))
    if (!Number.isFinite(n) || n <= 0) throw createError({ statusCode: 400, statusMessage: 'amountUsdt > 0' })
    patch.amountUsdt = n
  }
  if ('eventAt' in body && body.eventAt !== undefined) {
    const d = new Date(String(body.eventAt))
    if (Number.isNaN(+d)) throw createError({ statusCode: 400, statusMessage: 'invalid eventAt' })
    patch.eventAt = d
  }
  if ('note' in body) {
    patch.note = body.note == null || String(body.note).trim() === '' ? null : String(body.note).trim()
  }

  await db.update(propEvents).set(patch as never).where(eq(propEvents.id, id))
  const [row] = await db.select().from(propEvents).where(eq(propEvents.id, id))
  return serializePropEvent(row)
})
